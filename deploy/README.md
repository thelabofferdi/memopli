# Déploiement

## Sur le VPS (Docker)

```bash
git clone <repo> soumission && cd soumission
cp .env.example .env          # renseigner RODIUM_API_KEY
cd frontend && npm ci && npm run build && cd ..
rsync -a frontend/dist/ ./dist/

docker compose -f deploy/docker-compose.yml up -d --build
```

Le `Caddyfile` sert `frontend/dist` et relaie `/api` vers l'API. Adapter le domaine.

## Vérifier

```bash
curl -s https://<domaine>/health
```

Réponse attendue : `{"ok":true,"service":"memopli","version":"0.2.0","ai_key":true,"auth_required":true}`.

## Sécurité du déploiement

- `APP_ENV=prod` **exige** `AUTH_REQUIRED=true` et une origine CORS explicite : l'API
  refuse de démarrer sinon (`config.enforce()`).
- L'API tourne avec `--no-proxy-headers` : c'est elle qui lit le dernier saut de
  `X-Forwarded-For`, et seulement si `TRUST_PROXY=true` (le cas derrière Caddy).
- `--no-access-log` : le journal d'accès est celui de l'application (JSON, avec
  `request_id`), pas celui d'uvicorn.
- Le compartiment `api` reste en `APP_ENV=dev` tant que le frontend n'envoie pas de
  jeton : basculer les deux variables ensemble, sinon plus aucune route ne répond.

Détail des garde-fous : `docs/10-securite.md`.

## Sans Docker (dépannage)

```bash
python3 -m venv .venv && ./.venv/bin/pip install -r backend/requirements.txt
./.venv/bin/uvicorn app.main:app --app-dir backend --port 8000 --no-proxy-headers --no-access-log
```

Puis servir `frontend/dist` avec n'importe quel serveur statique, en gardant `/api` sur le port 8000.
