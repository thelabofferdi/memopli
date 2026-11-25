# MemoPli

Le poste de travail des appels d'offres : on dépose un DAO et ses pièces, on obtient la grille du bailleur, l'état de conformité, et une section de mémoire technique rédigée avec ses propres chantiers.

> **Promesse :** deux heures plus tard, un mémoire technique structuré sur la grille d'évaluation, prêt à relire et à signer.

## Démarrage

```bash
cp .env.example .env        # renseigner RODIUM_API_KEY
make install                # venv backend + deps front
make api                    # http://127.0.0.1:8000/health
make web                    # http://127.0.0.1:5173
```

Sans Node ni build, on peut aussi servir le front compilé par FastAPI (`make build-web`).

## Structure

```
backend/app/        FastAPI : main, db, ai, extract, schemas, config, auth, errors, uploads,
                    ocr (local), ingest (découpage, index), rag (BM25), agent (Pli), state, middleware
backend/tests/      138 tests (pytest)
frontend/src/
  main.jsx, Root.jsx  point d'entrée et routage (#/, #/connexion, #/app/…)
  lib/              api, format (statuts, dates), router, utils
  styles/           styles.css (styles maison), rare.css (Tailwind limité à Rare UI)
  landing/          page publique en français et en anglais (Landing) et ancienne version (LandingV1, #/v1)
  pages/            espace client : accueil, dossiers, dossier, documents, recherche, compte
  components/       composants de l'application ; brand/ (logo, mascotte Pli) ; ui/ (Rare UI)
docs/               PRD, architecture, modèle de données, API, prompts, démo, business model,
                    sources, identité, sécurité
demo/               PDF fictifs pour tester le parcours + mode d'emploi (LISEZMOI.md)
deploy/             docker-compose, Caddyfile, procédure de déploiement
data/               base SQLite + uploads (ignoré par git)
```

## Modèles d'IA

Tous les appels passent par l'API RodiumAi (compatible OpenAI), modèles réglables dans `.env`.

| Tâche | Modèle par défaut |
|---|---|
| Extraire exigences, critères et pondérations du DAO | Claude Haiku 4.5 |
| Rapprocher exigences et pièces (le code décide du statut) | Gemini 3.5 Flash-Lite |
| Rédiger la section méthodologie | Claude Haiku 4.5 |
| Répondre aux questions sur le dossier (Pli) | Gemini 3.5 Flash |

L'OCR (Tesseract) et la recherche (BM25) tournent en local : les pièces ne partent jamais
au modèle, seuls leur intitulé, leur type et leur date.

## Sécurité et tests

Contrat d'erreur unique, `X-Request-ID` par requête, en-têtes de sécurité, uploads
vérifiés sur le contenu, limitation de débit sur les routes qui appellent le modèle,
et journal des appels IA avec tokens, durée et coût. Par défaut `AUTH_REQUIRED=false`
(API ouverte, mode démonstration) ; en production, mettre `AUTH_REQUIRED=true` dans
`.env` pour exiger un jeton.

```bash
make test    # erreurs, uploads, comptes et isolation, débit, intégrité, migration,
             # ingestion, recherche BM25, agent, photo de pièce (102 tests)
```

Constats, correctifs et limites : `docs/10-securite.md`. Contrat à jour : `docs/04-api.md`.
Architecture point par point : `docs/11-architecture-backend.md`.

## Tester avec des documents fictifs

`demo/pdfs/` contient un appel d'offres de 8 pages et 11 pièces d'entreprise, tous fictifs
(filigrane « SPÉCIMEN — FICTIF »). `demo/LISEZMOI.md` donne les intitulés et dates à saisir
et le résultat attendu : « Pas prêt » à cause de l'attestation CNSS expirée, puis « Prêt »
après son remplacement. Régénérer : `python3 demo/generer.py` (Chrome requis).

## Le parcours à démontrer

1. créer l'entreprise,
2. déposer 3 pièces, dont une périmée et une **photographiée** (l'OCR local lit la photo),
3. déposer le DAO,
4. extraire les exigences (avec la page source),
5. voir « Pas prêt », remplacer la pièce, voir « Prêt »,
6. générer la section méthodologie,
7. demander à Pli « quel est le montant de la garantie de soumission ? » : il répond avec
   le montant et sa page, ou « le dossier ne le dit pas ».

## Limites connues

- Une seule section du mémoire est rédigée (méthodologie), pas le mémoire complet.
- Le rapprochement s'appuie sur l'intitulé des pièces : un intitulé vague peut laisser une
  exigence « manquante » (nommer une référence avec son objet et son montant).
- Pas d'export PDF de la checklist, pas de réinitialisation de mot de passe, un seul
  utilisateur par entreprise.
- Base SQLite sur un seul serveur, sauvegarde manuelle (copie du fichier).
- Testé sur des DAO fictifs ; un vrai DAO scanné de 80 pages reste à valider.

## Documents

| Fichier | Contenu |
|---|---|
| `docs/01-prd.md` | problème, cible, périmètre, exigences, risques |
| `docs/02-architecture.md` | choix techniques du MVP |
| `docs/03-data-model.md` | schéma SQL et règles de statut |
| `docs/04-api.md` | contrat d'API |
| `docs/05-prompts.md` | prompts et garde-fous IA |
| `docs/06-demo.md` | script vidéo et test utilisateur |
| `docs/07-business-model.md` | Business Model Canvas et concurrence |
| `docs/08-sources.md` | chiffres et liens |
| `docs/09-identite.md` | nom, signe, couleurs, typographie |
| `docs/10-securite.md` | état des lieux sécurité et correctifs |
| `docs/11-architecture-backend.md` | canevas du back-end : chaîne d'une requête, décisions par fonctionnalité |

## Outils utilisés

- Bibliothèques principales : FastAPI, pypdf, httpx (backend) ; React, Vite, Tailwind CSS,
  Motion, sonner (frontend).

## Crédits

- Composants animés : [Rare UI](https://rareui.com) par Swami Malode, licence MIT + Commons Clause + Attribution (`frontend/src/components/ui/`).
- Mise en page de la page publique inspirée de « mesa » par LN ([landing-pages](https://github.com/ln-dev7/landing-pages)), licence MIT.
- Polices Bricolage Grotesque, Geist et DM Mono : SIL OFL 1.1 (`frontend/public/fonts/`).
