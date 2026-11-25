# 10 — Sécurité du back-end : état des lieux et cibles

État des lieux au 25/11/2026, avant durcissement. Cible = ce qui est écrit dans
`02-architecture.md` §Sécurité, `01-prd.md` §9 (non-fonctionnel) et `AGENTS.md`.

Sévérités : **C** critique (exploitable, casse l'isolation), **É** élevée
(exploitable en production), **M** moyenne (robustesse, coût, traçabilité),
**F** faible (hygiène).

Les numéros de ligne de la section 1 renvoient au code **d'avant correctif** : ils
datent l'audit. L'état livré est décrit en sections 4 et 5.

## 1. Constats

| # | Constat | Preuve | Cible | Sév. | Correctif | Test |
|---|---|---|---|---|---|---|
| 1 | Aucune authentification : l'`org_id` vient du client (form/query) | `main.py:104` (`Form(...)`), `main.py:126` (`org_id: str`) | F1 « créer un compte (e-mail + mot de passe) » ; isolation par `org_id` | **C** | `auth.py` : comptes, mot de passe pbkdf2, jeton opaque haché, dépendance Bearer. Drapeau `AUTH_REQUIRED` (défaut off pour ne pas casser le front en cours) | `test_auth.py::test_login_and_bearer` |
| 2 | Aucun contrôle d'appartenance sur les routes par identifiant | `main.py:129` (delete pièce), `main.py:159`, `main.py:258`, `patch_requirement` `main.py:207` | isolation par `org_id` | **C** | `auth.assert_access()` appelé sur chaque route dès qu'un jeton est présent, et obligatoire si `AUTH_REQUIRED` | `test_auth.py::test_cross_org_is_404` |
| 3 | Erreurs hors contrat : `HTTPException` renvoie `{"detail":…}` alors que le front lit `{"error":{code,message}}` | `main.py:56,59,93,159,179,258,326` vs `frontend/src/api.js:26-28` | `AGENTS.md` : `{"error":{code,message}}` | **É** | handlers globaux dans `errors.py` (HTTP, validation, 500) | `test_errors.py` |
| 4 | Upload : extension seule, contenu lu en entier (`await file.read()`) **avant** le plafond, parsing PDF synchrone dans un endpoint `async` | `main.py:55-61`, `main.py:143` | uploads limités en taille **et** en type | **É** | `uploads.py` : lecture en flux plafonnée, magic bytes `%PDF-`, fichier vide refusé, parsing via `run_in_threadpool`, plafond de pages | `test_uploads.py` |
| 5 | CORS `*` (par défaut), `allow_methods=["*"]`, `allow_headers=["*"]`, pas de `TrustedHost`, aucun en-tête de sécurité | `main.py:35-39` | « en-têtes CORS limités à l'origine du front » | **É** | origine(s) depuis l'env, méthodes et en-têtes énumérés, `TrustedHostMiddleware`, en-têtes `nosniff`/`DENY`/CSP | `test_errors.py::test_security_headers` |
| 6 | Aucun journal : ni `request_id`, ni appels IA persistés (extraction et rapprochement ne laissent aucune trace, `drafts` garde modèle et tokens mais pas la durée ni le coût) | `drafts` schéma `db.py:33-36` ; aucun `logging` dans `app/` | `/health`, « journaux avec `request_id` », appel IA journalisé (modèle, tokens, durée, coût) | **M** | middleware `request_id` + table `ai_calls` + `GET /api/tenders/{id}/cost` | `test_ai_log.py` |
| 7 | Aucune limitation de débit sur les routes qui appellent le modèle ni sur l'upload | aucune occurrence | coût < 100 FCFA/dossier, robustesse | **M** | `ratelimit.py` (fenêtre glissante par IP), 429 + `Retry-After` | `test_ratelimit.py` |
| 8 | Config non validée : clé absente découverte seulement au premier appel (502) | `ai.py:13,29-30` | clés dans `.env` uniquement | **M** | `config.py` chargé au démarrage, valeurs invalides refusées, clé manquante signalée au boot | `test_config.py` |
| 9 | Intégrité : extraction cumulative (relancer duplique les exigences), `PATCH` accepte n'importe quel type, `kind` libre, date non validée, fichier de pièce non supprimé | `main.py:186-196`, `main.py:207-215`, `main.py:104` | « le code calcule », pas d'invention | **M** | extraction idempotente, `RequirementPatch` validé, `kind` et date validés, fichier unlink | `test_integrity.py` |
| 10 | Fuite d'information : le corps de la réponse du fournisseur est recopié au client | `ai.py:35` | message clair si l'IA échoue | **M** | message court côté client, détail complet dans le journal serveur | `test_ai_log.py::test_ai_error_is_short` |
| 11 | `/docs` et `/openapi.json` ouverts | `main.py:33` | — | **F** | `DOCS_ENABLED` (défaut on en dev, off en prod) | `test_config.py` |
| 12 | Pas de HTTPS applicatif | — | PRD §9 | **F** | assumé par Caddy en frontal (`deploy/`) | manuel |

### Ce qui était déjà correct (à ne pas casser)

- SQL entièrement paramétré (23 `execute` avec placeholders), aucune concaténation de valeur.
- `PATCH` filtré par liste blanche de champs (`main.py:208-211`), pas d'injection par nom de colonne.
- Nom de fichier généré côté serveur (`{prefix}.pdf`), pas de traversée de chemin.
- Les pièces ne partent jamais au modèle : seuls `label`, `kind`, `expires_on` (`main.py:245`, `main.py:334`).
- Aucun fichier d'upload servi en statique ; aucune clé dans le dépôt (`.env.example` vierge).

## 2. Décisions

- **Auth derrière `AUTH_REQUIRED`** (défaut `false`) : le frontend est en cours de
  réécriture par un autre agent ; on ajoute les routes, pas une rupture. Avec un
  jeton présent, l'isolation est appliquée même drapeau éteint.
- **404 plutôt que 403** sur une ressource d'une autre organisation : ne pas
  révéler l'existence d'un identifiant.
- **Jeton opaque** (32 octets) stocké **haché** (SHA-256), pas de JWT : révocation
  immédiate possible, aucune clé de signature à gérer.
- **Mot de passe** : pbkdf2-hmac-sha256, 240 000 itérations, sel par utilisateur,
  comparaison à temps constant ; 8 à 128 caractères.
- **`org_id` reste accepté en query/form** tant que `AUTH_REQUIRED` est faux :
  le parcours de démonstration actuel continue de fonctionner.

## 3. Reste hors périmètre

- URL signées pour servir les pièces (aucun fichier n'est servi aujourd'hui).
- Second facteur, réinitialisation de mot de passe, multi-utilisateurs par entreprise.
- Quotas par entreprise (aujourd'hui : par IP).
- Chiffrement au repos de `data/app.db`.
- Réinitialisation du mot de passe (aucun envoi d'e-mail dans le MVP).

## 4. État après durcissement

Chaque constat de la section 1 a un correctif en place et un test qui échoue si on
le retire (78 tests, `make test`).

| # | Correctif livré | Fichier | Test |
|---|---|---|---|
| 1 | comptes, pbkdf2 240 k itérations, jeton opaque haché SHA-256, rôles par drapeau | `auth.py` | `test_auth.py` (7 tests) |
| 2 | `assert_access()` sur chaque route ; 404 pour la ressource d'autrui | `auth.py`, `main.py` | `test_auth.py::test_cloisonnement_*` |
| 3 | handlers `ApiError`, `HTTPException`, `RequestValidationError`, `Exception` | `errors.py` | `test_errors.py` (8 tests) |
| 4 | flux plafonné, magic bytes `%PDF-`, fichier vide refusé, corps compté octet par octet (`BodyLimit`) et refusé sur `Content-Length`, parsing en thread, plafond lu avant extraction | `uploads.py`, `middleware.py`, `main.py` | `test_uploads.py` (7 tests) |
| 5 | origines/méthodes/en-têtes énumérés, contrôle d'hôte maison, CSP, `nosniff`, `DENY`, `no-referrer`, `no-store` | `middleware.py`, `main.py` | `test_errors.py::test_en_tetes_*`, `test_hote_inconnu_refuse` |
| 6 | `X-Request-ID` propagé et journalisé (une ligne JSON par requête), table `ai_calls`, `GET /api/tenders/{id}/cost` | `middleware.py`, `audit.py` | `test_ai_log.py`, `test_errors.py::test_request_id_*` |
| 7 | fenêtre glissante par IP : 10/min sur l'auth, 60/h sur les uploads, 60/h sur les appels IA | `ratelimit.py` | `test_ratelimit.py` (3 tests) |
| 8 | `config.py` chargé au démarrage, valeurs hors bornes refusées, clé absente et mode ouvert signalés dans le journal | `config.py` | `test_config.py` (6 tests) |
| 9 | extraction idempotente (`replaced`), PATCH typé, `kind` et date validés, fichier et rapprochements effacés avec la pièce | `main.py`, `schemas.py` | `test_integrity.py` (7 tests) |
| 10 | message client court et stable, détail fournisseur au journal | `main.py` | `test_ai_log.py::test_echec_ia_*` |
| 11 | `DOCS_ENABLED` (fermé par défaut) et `APP_ENV` : `prod` refuse de démarrer ouvert | `config.py` | `test_config.py`, `test_durcissement.py` |

Migration : une base créée avant l'authentification s'ouvre et se migre seule
(colonne `user_id`, tables `users`/`sessions`/`ai_calls`, index) —
`test_migration.py`.

### Ce qui reste volontairement ouvert

- **`AUTH_REQUIRED=false` par défaut** : l'API est ouverte, pour ne pas casser le
  frontend en cours de réécriture. Sur le VPS, mettre `AUTH_REQUIRED=true` dans
  `.env` : sans jeton, toute route `/api` répond `401`. La santé reste publique.
- **Compteurs de débit en mémoire** : remis à zéro au redémarrage, non partagés
  entre processus. Un seul worker uvicorn, comme aujourd'hui.
- **HTTPS** : assuré par Caddy en frontal (`TRUST_PROXY=true` pour lire
  `X-Forwarded-For`), pas par l'application.


## 5. Après la relecture adverse

Une relecture indépendante (serveurs jetables, tests réels) a trouvé des défauts que
la première passe n'avait pas vus. Corrigés depuis :

| Constat | Correctif | Test |
|---|---|---|
| Jeton **présent mais invalide** = anonyme (fail-open) : un client qui croit s'authentifier accédait à tout | `optional_user` refuse : 401 si l'en-tête est présent et invalide, 401 si le schéma est inconnu | `test_jeton_invalide_ne_retombe_pas_en_anonyme` |
| `X-Forwarded-For` contournait les compteurs (uvicorn lit l'en-tête par défaut ; `TRUST_PROXY` prenait le saut **de gauche**, fourni par le client) | uvicorn en `--no-proxy-headers`, l'app lit le saut de **droite** validé par `ipaddress` ; une IP invalide tombe dans un compartiment commun | `test_ip_invalide_regroupee`, vérifié au curl (12 XFF variables → 429) |
| Corps **chunked** sans `Content-Length` : aucun plafond (RSS ×6 pour une requête) | middleware `BodyLimit` qui compte les octets et substitue son 413 (le lever d'exception était traduit en 400 par FastAPI) | `test_corps_chunked_plafonne`, RSS stable mesurée |
| Plafond de pages vérifié **après** extraction (6 Mo → 10 s CPU, 165 Mo) | `len(reader.pages)` lu avant la première page, arrêt au plafond de caractères, OCR borné à 40 pages | `test_plafond_de_pages_verifie_avant_extraction` |
| `extraction_invalide` recopiait la sortie du modèle (`input_value`) au client | message fixe, détail au journal | `test_extraction_non_conforme_ne_recopie_pas_le_modele` |
| Énumération de comptes : 3,7 ms pour une adresse inconnue contre 311 ms pour une vraie | hachage de référence exécuté aussi pour un compte inexistant, plus 5 échecs par compte / 15 min | `test_tentatives_par_compte_plafonnees` |
| `a@b.bj` et `a@b.bj.` = deux comptes | domaine normalisé (point final retiré), `..` refusé | `test_email_avec_point_final_est_le_meme_compte` |
| `MAX_BUCKETS` faisait `clear()` : l'attaquant offrait une remise à zéro générale | éviction LRU du compartiment le plus ancien | `test_eviction_lru_ne_remet_pas_les_compteurs_a_zero` |
| Route `/api` inconnue servie en HTML par le montage statique (le front perdait `code`/`message`) | route attrape-tout `/api/{chemin}` au contrat JSON, avant le montage | `test_route_api_inconnue_repond_json` |
| `Host: hôte@attaquant` accepté | hôte analysé par `urlparse`, `@`, espace et `/` refusés | `test_hote_arobase_refuse` |
| `/docs` ouvert par défaut | `DOCS_ENABLED=false` par défaut | `test_docs_fermees_par_defaut` |
| `APP_ENV=prod` avec `AUTH_REQUIRED=false` démarrait quand même | `config.enforce()` refuse le démarrage | `test_prod_refuse_de_demarrer_ouvert` |
| `PATCH` ne savait pas vider `page`/`weight`/`excerpt` | `null` accepté pour ces trois colonnes seulement | `test_patch_peut_effacer_un_champ_nullable` |
| Sessions expirées jamais purgées | purge au démarrage | `test_session_expiree_refusee_et_purgee` |

### Ce qui reste ouvert, en connaissance de cause

- **Jeton obligatoire, désormais actif** : le frontend envoie `Authorization: Bearer`
  sur chaque requête et redirige vers `#/connexion` sans session. L'instance de
  démonstration tourne avec `AUTH_REQUIRED=true` : sans jeton, toute route `/api`
  répond 401. Vérifié de bout en bout (connexion dans l'interface, dossier affiché).
- **Le dossier de démo a un propriétaire** : compte `demo@memopli.bj`, entreprise
  `org_demo01`. La procédure de recréation est dans `docs/06-demo.md` ; le mot de passe
  n'est volontairement pas dans le dépôt.
- **Bascule prod** : `deploy/docker-compose.yml` laisse `APP_ENV` en `dev` par défaut ;
  l'API est maintenant prête pour `APP_ENV=prod` + `AUTH_REQUIRED=true` (les deux
  ensemble, sinon elle refuse de démarrer).
- **Pas encore de changement ni de réinitialisation de mot de passe** : un mot de passe
  oublié se règle en base pour l'instant.
- **Compteurs de débit** en mémoire, un seul processus.
- **Pertes silencieuses de messages anglais** : les refus de préflight CORS restent en
  texte Starlette (`Disallowed CORS origin`), hors contrat JSON — un navigateur ne lit
  jamais ce corps, mais un client technique le verra.
