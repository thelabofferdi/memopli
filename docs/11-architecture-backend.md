# 11 — Architecture du back-end, point par point

Canevas visuel : [`11-architecture-backend.svg`](11-architecture-backend.svg)
(à ouvrir dans un navigateur, `xdg-open docs/11-architecture-backend.svg`).
Contrat d'API : [`04-api.md`](04-api.md). Constats sécurité : [`10-securite.md`](10-securite.md).

Version 0.2.0 — un seul processus FastAPI, une base SQLite, un client IA.
Le code calcule et décide ; l'IA lit et propose.

## 1. La chaîne d'une requête

```
Navigateur ─▶ Caddy ─▶ HttpGuard ─▶ BodyLimit ─▶ CORS ─▶ gestionnaire d'erreurs ─▶ auth + débits ─▶ route ─▶ SQLite / IA
```

| Étape | Fichier | Ce que ça garantit | Preuve |
|---|---|---|---|
| `HttpGuard` | `middleware.py` | `X-Request-ID` (repris s'il est valide, sinon regénéré), hôte en liste blanche, en-têtes de sécurité, `no-store` sur `/api`, une ligne de journal JSON par requête | `test_errors.py`, `test_hote_*` |
| `BodyLimit` | `middleware.py` | plafond du corps **compté octet par octet**, y compris `Transfer-Encoding: chunked` (sans `Content-Length`) ; 413 au contrat | `test_corps_chunked_plafonne` |
| CORS | `main.py` | origines, méthodes et en-têtes énumérés ; jamais `*` par défaut | `test_errors.py` |
| Gestionnaire d'erreurs | `errors.py` | toute erreur sort en `{"error":{code,message,request_id}}` : 404, 422, 429, 405, 500 compris | `test_errors.py` (8 tests) |
| Authentification | `auth.py` | `optional_user` : sans jeton → mode ouvert ou 401 selon `AUTH_REQUIRED` ; jeton présent mais invalide → **401**, jamais anonyme | `test_auth.py`, `test_durcissement.py` |
| Débits | `ratelimit.py` | 10/min par IP sur l'auth, 5 échecs/15 min par compte, 60/h sur les uploads, 60/h sur les appels IA ; `Retry-After` | `test_ratelimit.py` |
| Route | `main.py` | `assert_access` (404 pour la ressource d'autrui), validation Pydantic, SQL paramétré | `test_auth.py::test_cloisonnement_*` |

Un seul point d'entrée réseau sortant : `ai.py` (timeout 120 s). Aucun fichier déposé
n'est servi, il n'existe donc pas de route statique à protéger.

## 2. Le parcours d'un dossier

```
POST /api/tenders            → tenders + documents/chunks  + .pdf + .txt
POST …/requirements          → requirements (remplace la grille) + ai_calls
POST …/match                 → matches (statut calculé)          + ai_calls
GET  …/readiness             → verdict en lecture (aucune écriture)
POST …/draft                 → drafts                            + ai_calls
GET  …/cost                  → total recalculé depuis ai_calls
POST /api/search             → BM25 sur les morceaux de l'entreprise
POST /api/agent/chat         → réponse citée [p.N] + agent_messages + ai_calls
```

| Point clé | Choix | Méthode | Fichier |
|---|---|---|---|
| Dépôt du DAO | refuser tôt, ne jamais bloquer la boucle | extension → magic bytes `%PDF-` → flux plafonné 20 Mo → `run_in_threadpool(pypdf)` → **nombre de pages lu avant la première page** (400 max) → texte plafonné à 2 M caractères | `uploads.py`, `extract.py`, `main.py` |
| Pièce photographiée | une photo suffit | JPEG ou PNG reconnu aux magic bytes, puis `tesseract` (photo) ou `pdftoppm` + `tesseract` (PDF scanné), **toujours en local** ; `ocr_lang` dit quelle langue a servi | `uploads.py`, `ocr.py` |
| Indexation | le texte, découpé par page | `chunk_pages` ne laisse jamais un morceau à cheval sur deux pages ; `register` est idempotent par source (redéposer remplace l'index) | `ingest.py` |
| Extraction | relancer **remplace**, n'empile pas | suppression des exigences et rapprochements du dossier, puis insertion ; 60 000 caractères envoyés à la fois, avec balises `--- PAGE n ---` | `main.py:371` |
| Lecture de la réponse | aucune ligne perdue pour un nom de clé | `normalize_extract` accepte `name`/`label`, `type`/`kind`, `pondération`/`weight`, convertit les dates en ISO **dans le code**, met `page` à `null` hors document, puis `dedupe` retire la grille envoyée deux fois | `schemas.py:normalize_extract` |
| Rapprochement | l'IA désigne, le code tranche | envoi de `label`, `kind`, `expires_on` seulement ; identifiants validés contre le dossier et l'entreprise ; statut `valide / perime / manquant / a_verifier` calculé en comparaison de dates | `main.py:490`, `compute_status` |
| Verdict | jamais de statut inventé | `LEFT JOIN matches` : une exigence sans rapprochement compte comme **manquante** ; une pièce supprimée efface ses rapprochements ; `state.readiness` est la seule source | `state.py` |
| Recherche | lexicale, donc vérifiable | BM25 en Python pur sur les morceaux de l'entreprise ; `text` entier pour le modèle, `extrait` (400 caractères) pour l'affichage ; cloisonnement par `org_id` dans la requête SQL | `rag.py` |
| Agent | citer ou se taire | prompt strict : extraits **DAO seulement**, page entre crochets, « le dossier ne le dit pas », réponse point par point quand la question en porte plusieurs | `agent.py` |
| Rédaction | écrire avec les chantiers réels | entreprise, marché, acheteur, grille, références (métadonnées) ; « (à compléter) » si l'information manque ; refus en 409 sous deux références | `main.py:558` |
| Coût | survivre au rechargement | chaque appel écrit `ai_calls` (modèle, tokens, durée, coût, dossier, `request_id`, `ok`) ; `GET …/cost` additionne — le total n'est jamais stocké | `audit.py` |
| Pièces | métadonnées seulement | seuls l'intitulé, le type et la date sortent ; le fichier et son texte restent sur disque et dans l'index local | `uploads.py`, `agent.py` |

## 3. Les quatre invariants, et où ils sont tenus

| Invariant (`AGENTS.md`) | Où |
|---|---|
| « le code calcule, l'IA lit » : dates, statuts, totaux, seuils | `compute_status`, `state.readiness`, `audit.tender_cost` ; `schemas.iso_date` convertit l'échéance en ISO ; l'IA ne renvoie jamais de statut |
| « chaque valeur extraite porte sa page » | `requirements.page` alimenté par le modèle, contraint `1..5000` par le schéma ; `normalize_extract` met `null` plutôt qu'une page hors du document |
| « aucune clé dans le dépôt » | `config.py` lit `.env` / l'environnement, `.env` est ignoré par git, `.env.example` ne contient aucune valeur |
| « les pièces ne partent jamais au modèle » | `agent.answer` ne cherche que `kinds=("dao",)` ; le test `test_agent_cite_les_pages_et_nenvoie_jamais_les_pieces` échoue si un octet d'une pièce apparaît dans le prompt |
| « pas d'invention » | message court et stable en 502, détail au journal ; `(à compléter)` dans le texte généré ; « le dossier ne le dit pas » dans l'agent |

## 4. État et dépendances

- **SQLite**, 12 tables : `organizations, users, sessions, pieces, tenders, requirements,
  matches, drafts, ai_calls, documents, chunks, agent_messages`. Pas de `REFERENCES` dans
  le schéma : l'intégrité est tenue par le code (`assert_access`, suppressions en cascade
  explicites), avec des index sur les colonnes de jointure. `init_db()` migre les bases
  existantes (colonne `user_id`, tables d'ingestion).
- **Fichiers** : `{td|pc}_{id}.pdf|.jpg|.png` + `{td}.txt`, sous `UPLOAD_DIR`, noms générés
  par le serveur, jamais servis, effacés avec leur ligne.
- **Identifiants** : `org_ pc_ td_ rq_ dr_ usr_ mt_ ai_ doc_ ch_` + 12 hex (48 bits).
- **Sessions** : jeton opaque 32 octets, seule son empreinte SHA-256 est stockée,
  expiration absolue à 30 jours, purge au démarrage.

## 5. Dette assumée

- compteurs de débit en mémoire (un seul processus uvicorn) ;
- pas de changement ni de réinitialisation de mot de passe ;
- pas de pagination sur `/api/pieces` et `/api/orgs/{id}/tenders` ;
- pas d'URL signée : aucune pièce n'est affichable aujourd'hui ;
- **recherche lexicale seulement** : BM25 retrouve les termes du document, pas les
  synonymes. « où déposer ? » ne ramène pas « secrétariat du marché » ; l'agent répond
  alors « le dossier ne le dit pas » au lieu d'inventer. Les embeddings du fournisseur
  sont en panne (502/503) : `rag.py` isole la recherche pour pouvoir la remplacer ;
- **OCR sans modèle français** : seul `eng` est installé, d'où `ocr_lang =
  "eng (modèle fra absent)"` ; les accents et certains mots sont mal lus. Installer
  `tesseract-ocr-fra` suffit, le code choisit la langue déclarée dans `OCR_LANGS` ;
- **pas de caméra côté API** : le backend accepte la photo, la prise de vue est un
  choix d'interface ;
- **pas de voix** : une mascotte qui parle suppose le modèle TTS du fournisseur, non branché ;
- tests : `make test` → 102 tests, dont 15 pour l'ingestion, la recherche, l'agent et la
  photo ; les appels réels au fournisseur IA sont remplacés par des doubles locaux.
