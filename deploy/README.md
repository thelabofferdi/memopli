# Déploiement

Ce qui tourne aujourd'hui (25 novembre 2026) :

| Partie | Où | Adresse |
|---|---|---|
| API | VPS Instabox (Docker, compartiment `deploy-api-1`) | https://8000-agq6ra3q6xupilbxsv53imlxwq.instabox.tech |
| Frontend | Vercel (projet `memopli`, dossier racine `frontend`) | https://memopli.vercel.app |
| Code | GitHub privé `thelabofferdi/memopli` | `main` |

Le frontend appelle `/api` en relatif ; `frontend/vercel.json` réécrit `/api/*` et
`/health` vers l'API. Le navigateur reste donc sur une seule origine (pas de CORS).

## VPS Instabox

```bash
ssh studio-vocal                 # ~/.ssh/config : ssh.instabox.sh:2222
cd ~/memopli/deploy
docker compose up -d --build      # .env à la racine de ~/memopli, jamais versionné
```

- Instabox ne publie pas les ports 80/443 (NAT) : il expose chaque port déclaré dans
  l'onglet **Ports** sous la forme `https://<port>-<instance>.instabox.tech`, TLS
  terminé par leur proxy. D'où le `ports: 8000:8000` sur le service `api`.
- Le service `caddy` ne sert que sur une machine où l'on contrôle 80/443 :
  `docker compose --profile tls up -d`. Sur Instabox, il est inutile.
- L'image de l'API installe `tesseract-ocr`, `tesseract-ocr-fra` et `poppler-utils` :
  l'OCR des pièces photographiées fonctionne en français en production.
- Données : volume `deploy_soumission_data` monté sur `/data` (`app.db` + `uploads/`).

## Vérifier

```bash
curl -s https://8000-agq6ra3q6xupilbxsv53imlxwq.instabox.tech/health
curl -s https://memopli.vercel.app/health          # même réponse, via la réécriture
```

Réponse attendue : `{"ok":true,"service":"memopli","version":"0.2.0","ai_key":true,
"auth_required":true,...,"ocr":{"langues":["eng","fra","osd"]},"rag":"bm25"}`.

## Redéployer

```bash
# API : copier les sources puis reconstruire
tar czf - --exclude='.git' --exclude='.venv' --exclude='node_modules' --exclude='.env' . \
  | ssh studio-vocal 'tar xzf - -C ~/memopli'
ssh studio-vocal 'cd ~/memopli/deploy && docker compose up -d --build'

# Frontend
cd frontend && vercel deploy --prod --yes
```

## Sécurité du déploiement

- `APP_ENV=prod` **exige** `AUTH_REQUIRED=true` et une origine CORS explicite : l'API
  refuse de démarrer sinon (`config.enforce()`). Attention : `docker-compose.yml`
  interpole `APP_ENV` depuis `deploy/.env` — sans ce fichier, le conteneur démarre en
  `dev` alors que le `.env` de la racine dit `prod`.
- `ALLOWED_HOSTS` doit contenir le nom public (`<port>-<instance>.instabox.tech`),
  sinon l'API répond `400` à toutes les requêtes.
- L'API tourne avec `--no-proxy-headers` : c'est elle qui lit le dernier saut de
  `X-Forwarded-For`, et seulement si `TRUST_PROXY=true`.
- `--no-access-log` : le journal d'accès est celui de l'application (JSON, avec
  `request_id`), pas celui d'uvicorn.
- Le `.env` de production est en `600` sur le serveur et n'est jamais copié dans l'image.

Détail des garde-fous : `docs/10-securite.md`.

## Sans Docker (dépannage)

```bash
python3 -m venv .venv && ./.venv/bin/pip install -r backend/requirements.txt
./.venv/bin/uvicorn app.main:app --app-dir backend --port 8000 --no-proxy-headers --no-access-log
```

Puis servir `frontend/dist` avec n'importe quel serveur statique, en gardant `/api` sur le port 8000.
