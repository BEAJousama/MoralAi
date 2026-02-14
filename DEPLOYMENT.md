# MoraLai – Deployment Guide

This guide explains **how** to deploy the app and **where** you can run it (VPS, PaaS, etc.). The stack is: **backend (Node + SQLite)** + **frontend (static + nginx)**. The database is SQLite stored on a single volume or disk.

---

## Production checklist

Before going live:

1. **Set a strong `JWT_SECRET`** (e.g. `openssl rand -hex 32`). Never commit it.
2. **Set `GEMINI_API_KEY`** and **`ELEVENLABS_API_KEY`** in the deployment environment.
3. **Use HTTPS** in front of the app (reverse proxy or platform TLS).
4. **Persist the SQLite DB** (volume or persistent disk) so data survives restarts.

---

## Option 1: VPS / any server (Docker)

**Where:** Any VPS (DigitalOcean, Linode, AWS EC2, Hetzner, etc.) or your own server.

**How:**

1. Install Docker and Docker Compose on the server.
2. Clone the repo and add a `.env` with production values (see README).
3. Run:

   ```bash
   docker compose up --build -d
   ```

4. Put a **reverse proxy** in front for HTTPS and (optional) a domain:
   - **Nginx** or **Caddy** on the host: proxy `https://yourdomain.com` → `http://localhost:3000` (frontend) and optionally `https://yourdomain.com/api` → `http://localhost:4000` (if you want to expose API directly; the frontend already proxies `/api` to the backend internally).
   - In practice you only need to proxy to **port 3000** (frontend); the browser talks to the same origin and nginx in the frontend container forwards `/api` to the backend.

5. **Persist DB:** The compose file already uses a volume `backend-data` for `/app/data`. On the VPS this is stored under Docker’s volume directory. Back it up periodically (e.g. copy `mindadapt.db` from the volume or from a bind mount).

**Example (Caddy on host, app on 3000):**

```text
yourdomain.com {
  reverse_proxy localhost:3000
}
```

---

## Option 2: Railway

**Where:** [Railway](https://railway.app) – good for Docker and small DBs.

**How:**

1. Create a new project and connect the repo.
2. Add **two services** from the same repo:
   - **Backend:** Root directory or `backend/`; use a **Dockerfile** (e.g. `backend/Dockerfile`). Set env: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `JWT_SECRET`, `SQLITE_DB_PATH` (e.g. `/app/data/mindadapt.db`). Add a **volume** mounted at `/app/data` so SQLite persists.
   - **Frontend:** Use `frontend/Dockerfile`. No env needed for API (set **backend URL** as Railway’s backend service URL only if you need to; with nginx proxy you usually point frontend’s proxy to the backend service hostname, e.g. `http://backend.railway.internal:4000` or the public backend URL).
3. Railway can assign a public URL to each service. Use the **frontend** URL as the app URL. Ensure the frontend nginx `proxy_pass` points to Railway’s backend URL (e.g. `https://your-backend.up.railway.app`) if they’re on different hosts; or use Railway’s private networking and point to the backend service name.
4. Set all env vars in the dashboard. Add a volume to the **backend** service at `/app/data`.

**Note:** Railway runs one Dockerfile per service. Use `backend/Dockerfile` and `frontend/Dockerfile`; you don’t run the root `docker-compose` on Railway unless you use a single “compose” service.

---

## Option 3: Render

**Where:** [Render](https://render.com).

**How:**

1. **Backend:** New **Web Service**; connect repo; root directory `backend`; build: `npm install && npm run build`; start: `npm start` (or `node dist/index.js`). Add env vars. Use a **persistent disk** (Render supports this) mounted at e.g. `/data` and set `SQLITE_DB_PATH=/data/mindadapt.db`.
2. **Frontend:** New **Static Site** or **Web Service**. If static: build command `npm run build`, publish `dist`. You’ll need to configure the API base URL to the backend URL (e.g. `VITE_API_BASE=https://your-backend.onrender.com`). Then the frontend will call the backend directly (no nginx proxy in prod unless you run the frontend as a Web Service with its own Dockerfile).
3. **Alternative (single deploy):** Run both with Docker: one Web Service using a Dockerfile that runs both (e.g. a custom Dockerfile that runs backend + nginx). That’s more work; the two-service approach is simpler.

---

## Option 4: Fly.io

**Where:** [Fly.io](https://fly.io).

**How:**

1. Install `flyctl` and log in.
2. Use **Docker** or **Docker Compose** on Fly. For compose, use `fly launch` with a compose file; Fly can run the two services and assign volumes.
3. For **backend:** Add a **volume** for SQLite (e.g. `fly volumes create mindadapt_data --size 1` and mount at `/app/data`). Set env: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `JWT_SECRET`, `SQLITE_DB_PATH=/app/data/mindadapt.db`.
4. For **frontend:** Build from `frontend/Dockerfile`; set the backend URL if needed (e.g. `https://your-app-backend.fly.dev`).
5. Enable **HTTPS** (Fly provides it by default).

---

## Option 5: Single VPS with Docker Compose (recommended for simplicity)

**Where:** One VPS (e.g. $5–10/month droplet).

**How:**

1. SSH into the VPS. Install Docker + Docker Compose.
2. Clone the repo, create `.env` from `.env.example`, set production secrets.
3. Run:

   ```bash
   docker compose up --build -d
   ```

4. Configure the firewall: allow 80/443 (and optionally 22 for SSH). Use Nginx or Caddy on the **host** to:
   - Listen on 80/443.
   - Proxy to `http://127.0.0.1:3000` (frontend container). No need to expose 4000 publicly; the browser only talks to port 3000, and nginx inside the frontend container proxies `/api` to the backend.

5. **Backup DB:** The SQLite file is in the Docker volume. To back up:

   ```bash
   docker compose exec backend cat /app/data/mindadapt.db > backup-$(date +%Y%m%d).db
   ```

   Or use a bind mount instead of a named volume and back up that directory.

---

## Summary: where to deploy

| Where | Best for | DB persistence |
|-------|----------|----------------|
| **VPS + Docker Compose** | Full control, one place for app + DB | Volume or bind mount |
| **Railway** | Fast setup, Docker, small teams | Volume on backend service |
| **Render** | Simple PaaS, static + backend | Persistent disk on backend |
| **Fly.io** | Global regions, Docker | Fly volumes |

In all cases:

- Set **`JWT_SECRET`**, **`GEMINI_API_KEY`**, **`ELEVENLABS_API_KEY`** (and optionally `GEMINI_MODEL`, `ELEVENLABS_VOICE_ID`).
- Ensure the **SQLite DB path** is on a **persistent volume/disk**.
- Put the app behind **HTTPS** (platform TLS or your own reverse proxy).

For the **simplest production path**, use a **single VPS + Docker Compose** and a reverse proxy (Nginx/Caddy) for HTTPS and domain.
