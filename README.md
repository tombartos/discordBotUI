# discordBotUI

UI React (Vite) pour piloter/consommer des endpoints type Discord bot.

## Structure

- `frontend/` : application React + Vite
- `Dockerfile` : build multi-stage (Node → Nginx)
- `nginx.conf` : configuration Nginx (SPA fallback + cache)

## Prérequis

- Docker (recommandé pour exécuter en prod)
- Node.js (si tu veux lancer en dev sans Docker)

## Lancer en production (Docker)

Build de l’image :

```bash
docker build -t discrordbotui:1.0.0 .
```

Lancer le container (port 8080 sur ta machine) :

```bash
docker run --rm -p 8080:80 discrordbotui:1.0.0
```

Puis ouvre : `http://localhost:8080`

### Note sur les appels API

En dev, Vite proxifie (voir `frontend/vite.config.js`) vers :

- `http://localhost:8080` pour `/invitation`, `/role`, `/user`, `/ping`
- `http://localhost:8081` pour `/bot-ping` (réécrit en `/ping`)

En production (image Nginx), ce proxy n’existe pas : Nginx sert uniquement des fichiers statiques.
Si ton UI appelle des routes `/invitation`, `/role`, etc., il faut soit :

- mettre le backend derrière le même domaine (reverse proxy),
- ou adapter l’app pour utiliser une URL d’API complète (ex: variable d’environnement) + CORS côté backend.

## Développement local (sans Docker)

Depuis `frontend/` :

```bash
npm ci
npm run dev
```

Build :

```bash
npm run build
```

Preview du build :

```bash
npm run preview
```
