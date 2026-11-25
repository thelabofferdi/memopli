# Contrat d'API

Base : `/api`. Corps JSON, sauf les dépôts de fichiers (multipart).
Identifiants : `org_`, `pc_`, `td_`, `rq_`, `dr_`, `usr_`, `mt_`, `ai_` + 12 hex.

## Erreurs

Toute erreur, y compris `404` et erreur de validation, sort sous la même forme :

```json
{ "error": { "code": "introuvable", "message": "DAO inconnu", "request_id": "3f9c…" } }
```

`request_id` est aussi renvoyé dans l'en-tête `X-Request-ID` de chaque réponse : il
suffit à retrouver la ligne de journal correspondante.

| Statut | Codes possibles |
|---|---|
| 400 | `requete_invalide`, `rien_a_modifier`, `type_inconnu`, `date_invalide`, `libelle_vide`, `libelle_trop_long`, `texte_insuffisant`, `fichier_vide`, `identifiants_invalides`, `hote_non_autorise` |
| 401 | `non_authentifie`, `identifiants_invalides` |
| 404 | `introuvable`, `organisation_inconnue` |
| 409 | `conflit`, `aucune_exigence`, `references_insuffisantes`, `compte_existant`, `texte_insuffisant` (texte du DAO disparu) |
| 413 | `fichier_trop_lourd` (y compris corps `chunked` sans `Content-Length`), `document_trop_long` |
| 415 | `format_non_supporte` |
| 422 | `requete_invalide`, `lecture_impossible` |
| 429 | `trop_de_requetes` (+ en-tête `Retry-After` en secondes) — par IP, et par compte sur `/api/auth/login` (5 échecs / 15 min) |
| 502 | `ia_indisponible`, `extraction_invalide` |
| 500 | `erreur_interne` |

`ia_indisponible` et `extraction_invalide` portent un message court et stable : le
détail du fournisseur et la sortie du modèle restent dans le journal serveur.

Toute route `/api/...` inconnue répond ce contrat en `404` (jamais du HTML), même
quand le front compilé est monté sur `/`. Seule exception : les refus de préflight
CORS, émis en texte par Starlette — un navigateur ne lit pas ce corps.

## Authentification

Comptes e-mail + mot de passe. Jeton opaque transmis en `Authorization: Bearer <token>`.
Le serveur ne stocke que l'empreinte SHA-256 du jeton et un hachage pbkdf2 du mot de passe.

`AUTH_REQUIRED` (défaut `false`) décide si l'API exige un jeton. Quand il est faux,
l'API reste ouverte — mode démonstration — mais un jeton présent borne l'accès aux
organisations de son propriétaire. Ressource d'une autre organisation : `404`,
jamais `403`, pour ne pas révéler son existence.

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/signup` | `{email, password, org_name?}` → compte, entreprise et jeton |
| POST | `/api/auth/login` | `{email, password}` → jeton |
| POST | `/api/auth/logout` | révoque le jeton présenté |
| GET | `/api/auth/me` | utilisateur + ses organisations |

`POST /api/auth/signup` → 

```json
{ "user": { "id": "usr_9a1c…", "email": "contact@btp-adjovi.bj" },
  "org": { "id": "org_4f2b…", "name": "BTP Adjovi" },
  "token": "mpl_…", "expires_at": 1798761600 }
```

## Routes

| Méthode | Route | Rôle | Débit |
|---|---|---|---|
| GET | `/health` | `{ok, service, version, ai_key, auth_required, modeles, ocr, rag}` | — |
| POST | `/api/orgs` | créer une entreprise (rattachée au compte si jeton) | — |
| GET | `/api/orgs/{id}` | profil de l'entreprise | — |
| PATCH | `/api/orgs/{id}` | compléter le profil (`name`, `ifu`, `rccm`, `sector`, `headcount` ; `null` efface un champ facultatif) | — |
| GET | `/api/orgs/{id}/tenders` | dossiers de l'entreprise, du plus récent au plus ancien, avec `requirements` et `drafts` (nombres) | — |
| POST | `/api/pieces` | déposer une pièce (multipart : `org_id`, `kind`, `label`, `expires_on`, `file` PDF, JPEG ou PNG) ; une photo est lue par l'OCR local | upload |
| GET | `/api/pieces?org_id=` | lister les pièces | — |
| DELETE | `/api/pieces/{id}` | supprimer une pièce (fichier et rapprochements compris) | — |
| POST | `/api/tenders` | déposer un DAO (multipart : `org_id`, `file`) → texte extrait | upload |
| GET | `/api/tenders/{id}` | métadonnées du DAO | — |
| POST | `/api/tenders/{id}/requirements` | lancer l'extraction | IA |
| GET | `/api/tenders/{id}/requirements` | lister les exigences | — |
| PATCH | `/api/requirements/{id}` | corriger `label`, `kind`, `mandatory`, `weight`, `page`, `excerpt` | — |
| POST | `/api/tenders/{id}/match` | rapprocher exigences ↔ pièces | IA |
| GET | `/api/tenders/{id}/readiness` | `{ready, blockers, checked, matched}` | — |
| POST | `/api/tenders/{id}/draft` | générer une section (`{section}`) | IA |
| GET | `/api/tenders/{id}/drafts` | lister les sections générées | — |
| GET | `/api/tenders/{id}/cost` | appels IA journalisés et coût cumulé | — |
| GET | `/api/documents?org_id=&tender_id=` | documents indexés, `index` (documents, caractères, morceaux) et état de l'OCR local | — |
| POST | `/api/tenders/{id}/index` | réindexer un DAO déjà déposé, sans redéposer le PDF | — |
| POST | `/api/search` | recherche lexicale BM25 (`{org_id, tender_id?, query, k?}`) sur les morceaux de l'entreprise | — |
| GET | `/api/agent/identity` | qui est Pli : rôle, capacités, limites, modèle | — |
| POST | `/api/agent/chat` | question à l'agent (`{org_id, tender_id?, message}`) → réponse, `citations`, `meta`, `contexte` | IA |
| GET | `/api/agent/history?org_id=&tender_id=` | les derniers échanges avec l'agent | — |

Types de pièce admis : `attestation_fiscale`, `cnss`, `rccm`, `reference`, `bilan`, `autre`.
`expires_on` : `AAAA-MM-JJ`.

## Exemples

`POST /api/tenders` → 

```json
{ "id": "td_7c1e…", "page_count": 84, "chars": 152340, "ocr": false,
  "document": { "id": "doc_9b2a…", "chunks": 84, "status": "ingere", "pages": 84,
                "chars": 152340, "ocr_lang": null } }
```

`POST /api/tenders/{id}/requirements` → **relancer remplace la grille**, elle ne s'empile pas.
`lecture` dit ce que la réponse du modèle a coûté : exigences écartées, pages hors document
(la page est alors `null`, jamais devinée) et doublons supprimés.

```json
{ "count": 12, "replaced": true, "title": "Réhabilitation voirie", "buyer": "Mairie de X",
  "deadline": "2026-12-18",
  "lecture": { "ignorees": 0, "sans_page": 0, "pages_hors_document": 1, "doublons": 4 },
  "meta": { "model": "anthropic/claude-haiku-4-5-20251001", "seconds": 12.9,
            "tokens_in": 1741, "tokens_out": 1509, "cost_fcfa": 11.14 } }
```

`POST /api/search` → `text` est le morceau entier (ce que lit l'agent), `extrait` les 400
premiers caractères (ce qu'on affiche) :

```json
{ "query": "garantie de soumission",
  "results": [ { "document_id": "doc_9b2a…", "kind": "dao", "page": 3, "score": 4.66,
                 "tender_id": "td_7c1e…", "piece_id": null,
                 "extrait": "Chapitre III — Conditions de participation…", "text": "…" } ],
  "index": { "documents": 2, "caracteres": 8082, "morceaux": 6 } }
```

`POST /api/agent/chat` → l'agent ne reçoit que des morceaux de DAO et les faits calculés
par le code ; `pieces_envoyees` reste à `0` par construction :

```json
{ "answer": "La garantie de soumission s'élève à 25 000 000 FCFA, soit 2 % du montant estimé [p.3].",
  "citations": [ { "document_id": "doc_9b2a…", "page": 3, "score": 4.66, "extrait": "…" } ],
  "meta": { "model": "google/gemini-3.5-flash", "seconds": 4.8,
            "tokens_in": 1140, "tokens_out": 943, "cost_fcfa": 7.03 },
  "contexte": { "morceaux": 3, "pieces_envoyees": 0 } }
```

`GET /api/tenders/{id}/readiness` →

```json
{ "ready": false, "checked": 6, "matched": 6,
  "blockers": [ { "requirement": "Attestation CNSS", "status": "perime",
                  "reason": "expirée le 2026-09-30", "expires_on": "2026-09-30" } ] }
```

`GET /api/tenders/{id}/cost` →

```json
{ "calls": [ { "task": "extraction", "model": "claude-haiku-4-5", "tokens_in": 15400,
               "tokens_out": 2100, "seconds": 18.4, "cost_fcfa": 31.08,
               "ok": 1, "created_at": "2026-11-25T14:02:11+00:00" } ],
  "totals": { "appels": 1, "tokens_in": 15400, "tokens_out": 2100,
              "seconds": 18.4, "cost_fcfa": 31.08 } }
```

## Changements par rapport à la version précédente

- Les `404` et `422` renvoient désormais `{"error": …}` et non plus `{"detail": …}`
  (le frontend lisait déjà `error.code` : c'est un correctif, pas une rupture).
- Relancer l'extraction **remplace** les exigences du dossier (`replaced: true`).
- `GET /api/pieces` et `GET /api/tenders/{id}` ne renvoient plus les chemins de
  fichiers du serveur.
- `DELETE /api/pieces/{id}` renvoie `404` si la pièce n'existe pas, et efface le
  fichier déposé ainsi que les rapprochements qui s'appuyaient dessus.
- Nouvelles routes : `/api/auth/*` et `/api/tenders/{id}/cost`.
- Nouvelles routes pour l'espace client : `PATCH /api/orgs/{id}` et `GET /api/orgs/{id}/tenders`
  (même contrôle d'appartenance que les autres routes ; tests : `tests/test_espace_compte.py`).
- Nouvelles routes d'ingestion et d'assistant : `GET /api/documents`,
  `POST /api/tenders/{id}/index`, `POST /api/search`, `GET /api/agent/identity`,
  `POST /api/agent/chat`, `GET /api/agent/history` (tests : `tests/test_rag_agent.py`).
- `POST /api/pieces` accepte désormais le JPEG et le PNG : une photo suffit pour une pièce.
  Le texte est lu par l'OCR **local** ; `ocr_lang` dit quelle langue a servi
  (`eng (modèle fra absent)` tant que le paquet de français n'est pas installé).
- L'extraction renvoie `deadline` en `AAAA-MM-JJ` (convertie par le code, jamais par le
  modèle) et `lecture`, le compte rendu de ce qui a été écarté.
- `/health` expose `modeles`, `ocr` (binaires et langues disponibles) et `rag`.
