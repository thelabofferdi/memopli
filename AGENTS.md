# AGENTS.md — Soumission

## Contexte

Capstone RodiumAi, phase 3 (Build the MVP). Le produit lit un dossier d'appel d'offres (DAO), rapproche ses exigences du coffre de pièces de l'entreprise, et rédige une section du mémoire technique.

## Règles absolues

1. **Le code calcule, l'IA lit.** Dates, statuts, totaux, seuils : jamais le modèle.
2. **Chaque valeur extraite porte sa page.** Pas de page, pas d'affichage.
3. **Aucune clé dans le dépôt.** `.env` uniquement, `.env.example` documenté.
4. **Les pièces ne partent jamais au modèle.** Seuls les intitulés, types et dates.
5. **Pas d'invention.** Si le document ne dit pas, l'interface dit « non extrait ».
6. **Une seule route critique à la fois** : le parcours upload → extraction → conformité → génération doit marcher avant toute autre fonctionnalité.

## Stack

- Backend : Python 3.12, FastAPI, SQLite (fichier `data/app.db`), `pypdf` pour le texte.
- Frontend : React 18 + Vite, pas de framework CSS, styles en un seul fichier.
- IA : API RodiumAi (compatible OpenAI) via `httpx`, modèles définis dans `backend/app/ai.py`.
- Déploiement : un VPS, `docker-compose` (api + caddy).

## Conventions

- Réponses d'erreur : `{"error": {"code","message"}}`.
- Identifiants : préfixes `org_`, `pc_`, `td_`, `rq_`, `dr_` + uuid4 hex tronqué.
- Nommage des fichiers d'upload : `data/uploads/{tender|piece}_{id}.{ext}`.
- Chaque appel IA journalise : modèle, tokens, durée, coût estimé.

## Ce qui est hors MVP

Radar multi-sources, mémoire complet, dépôt chez le bailleur, multi-utilisateurs, facturation.
