# Architecture

> Vue tracée du back-end, fonctionnalité par fonctionnalité : [`11-architecture-backend.md`](11-architecture-backend.md)
> et son canevas [`11-architecture-backend.svg`](11-architecture-backend.svg).

## Décision pour le MVP

Une seule application à déployer, pas de worker, pas de file d'attente : le temps de le faire fonctionner passe avant l'élégance.

| Couche | MVP (ce soir) | Cible (après) |
|---|---|---|
| Interface | React + Vite, bundle statique | idem |
| API | FastAPI (Python), un seul service | + worker séparé pour l'extraction longue |
| IA | API RodiumAi (OpenAI-compatible) | idem |
| Données | SQLite (fichier) | PostgreSQL |
| Fichiers | dossier `data/uploads` | volume + URL signées |
| Hébergement | VPS, `docker-compose` + Caddy | idem |

## Pourquoi SQLite maintenant

- zéro service à lancer, zéro migration, sauvegarde = un fichier ;
- le schéma est écrit de façon portable (pas d'auto-increment exotique), la bascule vers PostgreSQL est mécanique ;
- le risque « la base ne démarre pas à 3 h du matin » disparaît.

## Flux

```
navigateur (React)
      |
      v
 FastAPI  ---- RodiumAi (extraction, rapprochement, rédaction)
      |
      +--> SQLite (organisations, pièces, DAO, exigences, dossiers)
      +--> data/uploads (PDF, pièces)
```

## Ce qui reste vrai de la phase 2

- Le code calcule (dates, statuts, totaux), l'IA lit et rédige.
- Chaque valeur extraite porte sa page source.
- Les pièces ne partent jamais au modèle : seuls les intitulés et les dates.

## Sécurité minimale

- clés dans `.env`, jamais dans le bundle ni dans le dépôt ;
- `org_id` sur chaque table, filtré à chaque requête ;
- uploads limités en taille (20 Mo) et en type (`.pdf`) ;
- en-têtes CORS limités à l'origine du front.
