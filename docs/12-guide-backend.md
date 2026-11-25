# 12 — Guide de reprise du backend

À lire avant de toucher à `backend/`. Ce guide reprend la revue du 25/11/2026, vérifiée ligne par
ligne dans le code. Il dit aussi ce que le frontend attend de l'API : c'est là qu'on casse
l'application sans s'en rendre compte.

---

## 1. Les règles à ne jamais enfreindre

Elles viennent d'`AGENTS.md`. Une PR qui en viole une est refusée.

| Règle | Concrètement dans le backend |
|---|---|
| **Le code calcule, l'IA lit** | Statuts (`valide`/`perime`/`manquant`/`a_verifier`), dates, verdict, coûts : calculés en Python (`compute_status`, `state.readiness`, `state.facts`). Le modèle ne renvoie que des identifiants et des textes. |
| **Chaque valeur porte sa page** | Une exigence sans `page` ne doit pas être affichée comme fiable (voir défaut n° 4). |
| **Aucune clé dans le dépôt** | Le dépôt GitHub est **public**. Les secrets vont dans `.env` (ignoré par git). `.env.example` ne contient que des noms de variables, avec une valeur vide ou par défaut. |
| **Les pièces ne partent jamais au modèle** | Le rapprochement n'envoie que `id, label, kind, expires_on` (`main.py`, `/match`). Ne jamais lire `data/uploads/piece_*` pour l'envoyer à l'IA. |
| **Pas d'invention** | Une valeur absente vaut `null` ; le frontend affiche alors « non extrait ». Ne pas remplacer `null` par une valeur par défaut « plausible ». |
| **Une route critique à la fois** | Le parcours upload → extraction → conformité → rédaction doit rester vert à chaque commit. |

---

## 2. Installer, lancer, tester

```bash
python3.12 -m venv .venv            # 3.12 = version du Dockerfile ; ne pas développer en 3.14
.venv/bin/pip install -r backend/requirements.txt
cp .env.example .env                # puis renseigner RODIUM_API_KEY en local seulement
cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8000
```

Tests (138 verts au 25/11/2026) :

```bash
cd backend && ../.venv/bin/python -m pytest -q
```

- `tests/conftest.py` force une base temporaire, `AUTH_REQUIRED=false`, `RATE_LIMIT=false` et une
  clé API vide. **Les tests n'appellent jamais l'IA** : on remplace `ai.chat_json` par un faux
  (monkeypatch). Garder ce principe pour tout nouveau test.
- Le `.env` du poste n'est jamais lu en test (`ENV_FILE` pointe vers un fichier absent).

Frontend en local (pour vérifier qu'on n'a rien cassé) : `cd frontend && npm i && npm run dev`.
Vite redirige `/api` vers le port 8000.

---

## 3. Carte du code

| Fichier | Rôle |
|---|---|
| `app/main.py` | Toutes les routes. Extraction l. ~371, rapprochement l. ~500, `compute_status` l. ~489, rédaction l. ~568. |
| `app/state.py` | `readiness()` (verdict), `facts()` (faits calculés donnés à l'agent Pli). |
| `app/ai.py` | Client RodiumAi (httpx), modèles, `chat_json`, estimation du coût. |
| `app/audit.py` | Journal des appels IA (`ai_calls` : modèle, tokens, durée, coût). Tout appel IA doit passer par `audit.log_ai_call`. |
| `app/extract.py`, `app/ingest.py` | Lecture du PDF (pypdf), balisage `--- PAGE n ---`. |
| `app/ocr.py` | OCR (tesseract, et vision en option). Branché sur le DAO et sur les pièces depuis la correction du défaut n° 6. |
| `app/rag.py`, `app/agent.py` | Recherche BM25 et agent Pli (réponses avec citations de pages). |
| `app/auth.py` | Jetons `mpl_…`, `assert_access` (une entreprise ne voit que ses données). |
| `app/ratelimit.py`, `app/middleware.py` | Quotas, en-têtes de sécurité, hôtes autorisés. |
| `app/ids.py` | `nid("rq")` → identifiants préfixés ; `today()` (date) et `stamp()` (horodatage UTC). |
| `app/errors.py` | `abort(code, message, status)` → `{"error": {"code", "message"}}`. |
| `docs/04-api.md`, `docs/03-data-model.md` | Contrat API et schéma : les mettre à jour dans la même PR que le code. |

---

## 4. Le contrat avec le frontend : ne pas le casser

Le frontend (`frontend/src/lib/api.js`) appelle exactement ces routes :

```
GET  /health
POST /api/auth/signup | /login | /logout     GET /api/auth/me
POST /api/orgs        GET|PATCH /api/orgs/{id}      GET /api/orgs/{id}/tenders
GET  /api/pieces?org_id=   POST /api/pieces   DELETE /api/pieces/{id}
POST /api/tenders     GET /api/tenders/{id}
POST|GET /api/tenders/{id}/requirements      PATCH /api/requirements/{id}
POST /api/tenders/{id}/match                 GET /api/tenders/{id}/readiness
POST /api/tenders/{id}/draft                 GET /api/tenders/{id}/drafts
GET  /api/tenders/{id}/cost
GET  /api/documents   POST /api/tenders/{id}/index   POST /api/search
GET  /api/agent/identity   POST /api/agent/chat   GET /api/agent/history
```

Points sensibles :

- **Erreurs** : toujours `{"error": {"code", "message"}}`. Le frontend affiche `message` tel quel
  à l'utilisateur, donc il faut l'écrire en français clair, sans trace technique.
- **401** : le frontend vide la session (`memopli.token` dans le localStorage) et renvoie vers la
  connexion. Ne pas renvoyer 401 pour un simple refus d'accès : utiliser 403 ou 404.
- **404 sur un dossier** : l'écran affiche « ce dossier n'existe pas ou n'appartient pas à votre
  entreprise ». Garder 404 (et non 403) pour ne pas révéler l'existence d'un dossier.
- **Champs lus par l'écran** : les renommer casse l'affichage sans aucune erreur visible.
  - Dossier : `id, title, buyer, deadline, page_count, created_at, requirements, drafts`. Dans la
    liste, `requirements` et `drafts` sont des **compteurs**.
  - Exigence : `id, label, kind ('piece'|'critere'), mandatory, weight, page, excerpt, corrected`.
  - Pièce : `id, label, kind, expires_on`.
  - Verdict : `{ready, blockers[{requirement, status, reason, expires_on}], checked, matched}`.
    L'écran ne recharge le verdict que si `matched > 0`.
  - Rédaction : `id, section, content, created_at` ; agent : `answer, citations[{page, extrait}]`.
- **`weight`** est stocké en **points sur 100** (40 = 40 %). Le frontend tolère aussi une
  fraction (0.4), mais ne changez pas l'unité sans prévenir.
- **Dates** : chaînes ISO `AAAA-MM-JJ`. `null` si inconnue, jamais une chaîne vide.
- **« Remplacer » une pièce** côté écran = `DELETE` puis `POST`. Il n'existe pas de PATCH de
  pièce : si vous en ajoutez un, rien ne l'appellera tant que le frontend n'aura pas changé.
- **`pieceStatus`** (`frontend/src/lib/format.js`) reproduit `compute_status` pour la page « Mes
  documents », qui n'est rattachée à aucun dossier et compare donc à aujourd'hui. Si le statut
  d'un dossier passe à la date limite (défaut n° 2), les deux écrans peuvent légitimement
  diverger : prévenir le dev frontend pour ajouter un libellé.

---

## 5. Les défauts connus, vérifiés dans le code

Classés dans l'ordre où il faut les corriger. Pour chacun : ce qui ne va pas, l'endroit dans le
code, et la correction attendue.

### 1. Le statut est figé au moment du rapprochement (priorité haute)
`/match` écrit `matches.status` une fois pour toutes, et `state.readiness` relit cette colonne.
Une pièce qui expire après le rapprochement reste donc « valide » dans le verdict.
**Correction** : dans `readiness()`, recalculer le statut à la lecture à partir de
`p.expires_on` (la jointure le ramène déjà) avec la même fonction que `compute_status`. Il faut
aussi déplacer `compute_status` dans `state.py` pour éviter un import circulaire. La colonne
`status` ne sert plus alors que d'historique.

### 2. La validité est comparée à aujourd'hui, pas à la date limite du DAO (haute)
`compute_status` (main.py l. ~489) compare à `date.today()`. Une pièce valable aujourd'hui mais
expirée le jour du dépôt passe au vert, alors que le bailleur la rejettera.
**Correction** : `compute_status(piece, ref_date)` avec
`ref_date = max(today, tender.deadline)` si la date limite est connue, sinon aujourd'hui. Il faut
aussi un `reason` explicite, par exemple « expirera le 30/09 avant la date limite du 18/12 ».
Tests : une pièce qui expire entre aujourd'hui et la date limite doit être `perime`.

### 3. Le DAO est coupé à 60 000 caractères (haute)
`text[:60000]` (main.py l. ~389). Au-delà d'environ 25 pages denses, les exigences des pages
suivantes sont perdues **sans avertissement**.
**Correction minimale** : renvoyer dans `lecture` un `tronque: true` avec la dernière page lue,
pour que l'écran puisse l'afficher. **Correction complète** : découper par blocs de pages, extraire
bloc par bloc, fusionner avec `dedupe()` et journaliser chaque appel.

### 4. Les exigences sans page s'affichent quand même, et l'extrait n'est jamais vérifié (haute)
Cela viole la règle « pas de page, pas d'affichage ».
**Correction** dans `normalize_extract` :
- si `page` manque ou sort de `1..page_count`, mettre `confidence` à faible et marquer
  l'exigence comme à vérifier ;
- vérifier que `excerpt` se trouve bien dans le texte de cette page (comparaison normalisée :
  minuscules, espaces et ligatures). Si ce n'est pas le cas, l'exigence est à vérifier.

Il ne faut jamais inventer une page.

### 5. Le rapprochement ne contrôle pas le type (moyenne)
`/match` vérifie que les identifiants existent, mais le modèle peut associer une exigence
`critere` à une pièce, ou une attestation fiscale à l'exigence « CNSS ».
**Correction** : n'envoyer au modèle que les exigences `kind='piece'`. Il faut aussi refuser
côté code les couples dont les types sont incompatibles, avec une table de correspondance simple
entre les types de pièce et des mots-clés de l'exigence. Le refus est journalisé.

### 6. Les PDF scannés ne sont pas lus (moyenne)
`ocr.pdf_scanned_text` existe mais **n'est appelé nulle part** ; un DAO scanné finit en
`texte_insuffisant`. Le Dockerfile installe bien `tesseract-ocr-fra` et `poppler-utils`, mais
`pytesseract` et `pdf2image` manquent dans `backend/requirements.txt`.
**Correction** : au dépôt, si le texte fait moins de 500 caractères, passer par l'OCR (dans la
limite de `OCR_MAX_PAGES`). Il faut ajouter les deux dépendances Python et indiquer
`source: "ocr"` dans `lecture`. **Corrigé** : le repli se fait sous 500 caractères de texte
(`extract.MIN_CHARS`), `tenders.source` et `lecture.source` disent `ocr`, et `tronque` signale les
pages non lues. F10 peut passer de « Partiel » à « Fait » dans le canevas de soumission.

### 7. `today()` et `stamp()` pour l'ordre (basse)
`created_at` est écrit avec `today()`, c'est-à-dire une date sans heure, pour les entreprises,
pièces, dossiers, exigences, rapprochements et rédactions (main.py l. 157, 273, 344, 431, 544,
615). Le tri « du plus récent » est donc aléatoire dans une même journée, ce qui oblige certaines
requêtes à trier aussi sur `rowid`.
**Correction** : utiliser `stamp()` partout pour `created_at`. Le frontend affiche avec
`dateFr()`, qui accepte les deux formats. Il n'y a pas de migration à faire, car les anciennes
dates restent triables.

### 8. `.env.example` n'est pas synchronisé (basse, mais à faire en premier : c'est rapide)
Il contient d'anciens noms de modèles et il lui manque `MODEL_CHAT`, `MODEL_OCR`, `AI_TIMEOUT`,
`OCR_VISION`, `OCR_LANGS`, `OCR_MAX_PAGES`, `RAG_CHUNK_CHARS` et `RAG_K`.
**Correction** : reprendre exactement les noms et les valeurs par défaut de `app/config.py`.
Ajouter un test qui vérifie que chaque `os.getenv` de `config.py` figure dans `.env.example`.

---

## 6. Déploiement

| Point | État | À faire |
|---|---|---|
| `APP_ENV` | `docker-compose.yml` utilise `${APP_ENV:-dev}` par défaut | En production, mettre `APP_ENV=prod` dans le `.env` du serveur : l'API refuse alors de démarrer sans `AUTH_REQUIRED=true`, c'est voulu. |
| Caddy | Placé derrière le profil `tls` : un `docker compose up` simple ne le lance pas | `docker compose --profile tls up -d`, ou retirer le profil. |
| `TRUST_PROXY` | Vaut `"true"` en dur dans le compose | Ne le laisser à `true` que si Caddy est bien devant l'API. Sinon, n'importe qui peut usurper `X-Forwarded-For` et contourner les quotas. |
| `DOCS_ENABLED` | `false` par défaut | Le laisser à `false` en production. |
| Frontend | Vercel, projet `memopli`, dossier racine `frontend` | Changer l'URL de l'API exige un nouveau build du frontend : prévenir. |
| API de démonstration | Instabox, port 8000 | Ne pas y lancer de migration destructive : la démo du jury tourne dessus. |

`deploy/Caddyfile` contient l'IP du VPS, et le dépôt est public : n'y ajoutez rien d'autre de
sensible.

---

## 7. Hygiène et dette (non bloquant)

- Pas de route de suppression de dossier : à ajouter. Elle doit supprimer en cascade les
  exigences, rapprochements, rédactions, documents indexés et le fichier
  `data/uploads/tender_{id}.pdf`, puis être testée.
- Le jeton est stocké dans le localStorage (choix assumé pour le MVP). Passer à un cookie
  `HttpOnly` changerait le contrat : à décider avec le frontend.
- La taille du bundle, `LandingV1.jsx` et l'absence de tests frontend relèvent du frontend : ne
  pas s'en occuper ici.

---

## 8. Avant chaque PR

1. Lancer `pytest` : tout doit être vert, et chaque correction ci-dessus arrive avec son test.
2. Rejouer le parcours de démonstration (`demo/LISEZMOI.md`) sur une base vide. Résultat
   attendu :
   - 13 exigences, toutes avec leur page ;
   - « Pas prêt · 1 blocage : CNSS » ;
   - « Prêt » après le remplacement ;
   - une méthodologie qui cite la référence voirie Lagune-Est.

   C'est le test de non-régression de bout en bout. Après le défaut n° 2, les dates
   d'expiration seront comparées au 18/12/2026 : vérifier que le scénario tient encore, sinon
   ajuster `demo/generer.py`.
3. Mettre à jour `docs/04-api.md` si une réponse change.
4. Vérifier `git diff` : pas de `.env`, pas de clé, pas de fichier de `data/`.
5. Ne pas pousser directement sur `main` sans accord. Les déploiements (Vercel, Instabox, VPS)
   se font uniquement à la demande du responsable.

### Ordre de correction recommandé

1. Défaut n° 8 (`.env.example`).
2. Défauts n° 1 et 2 ensemble : la même fonction, avec la date de référence et un calcul à la
   lecture.
3. Défaut n° 4 (page et extrait).
4. Défaut n° 3 (troncature, d'abord le signalement).
5. Défaut n° 5 (contrôle du type).
6. Défaut n° 7 (`stamp()`).
7. Défaut n° 6 (OCR du DAO).
8. Suppression d'un dossier.
9. Réglages de déploiement.
