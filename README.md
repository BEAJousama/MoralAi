# MoraLai

A mental health check-in companion for university students. **Chat & assessment** use **Gemini**; **voice** (TTS/STT) uses **ElevenLabs**. Students can also complete a **form-based check-in** when the AI is unavailable. Data is stored in **SQLite** and visible in the admin panel.

## Project structure

| Path | Description |
|------|-------------|
| **`frontend/`** | React (Vite) app – login, chat, form fallback, assessment results, admin panel |
| **`backend/`** | Express API (TypeScript) – auth, Gemini chat/assessment, form assessment, ElevenLabs TTS/STT, SQLite |
| **`docker-compose.yml`** | Runs backend + frontend; SQLite DB stored in a Docker volume |

---

## Run with Docker (recommended)

**Prerequisites:** Docker and Docker Compose

1. **Create `.env`** at the project root (same folder as `docker-compose.yml`):

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env`** and set at least:
   - `GEMINI_API_KEY` – [Google AI Studio](https://aistudio.google.com/apikey)
   - `ELEVENLABS_API_KEY` – [ElevenLabs](https://elevenlabs.io)
   - `JWT_SECRET` – any long random string (e.g. `openssl rand -hex 32`)

3. **Build and run:**

   ```bash
   docker compose up --build -d
   ```

4. **Open** [http://localhost:3000](http://localhost:3000) (frontend). The API is at [http://localhost:4000](http://localhost:4000); the app uses the same origin (nginx proxies `/api` to the backend).

**DB:** SQLite is stored in the `backend-data` volume at `/app/data/mindadapt.db` inside the backend container. It persists across restarts. Default admin: **username `admin`**, **password `password`**.

**Stop:** `docker compose down` (add `-v` to remove the DB volume).

---

## Run locally (without Docker)

**Prerequisites:** Node.js 18+

### Backend

Uses the **root** `.env` (or `backend/.env` override).

```bash
cd backend
npm install
npm run build
npm run dev
```

Runs at **http://localhost:4000**. DB file: `data/mindadapt.db`. (relative to repo root or `backend/` depending on cwd).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at **http://localhost:3000**. Set `VITE_API_BASE=http://localhost:4000` in root `.env` if the backend is on another host/port.

---

## Environment variables (root `.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes (for chat/assessment) | [Google AI Studio](https://aistudio.google.com/apikey) |
| `ELEVENLABS_API_KEY` | Yes (for TTS/STT) | [ElevenLabs](https://elevenlabs.io) API key |
| `JWT_SECRET` | Yes | Long random string for JWT signing (register/login, admin) |
| `ELEVENLABS_VOICE_ID` | No | Default: `21m00Tcm4TlvDq8ikWAM` |
| `GEMINI_MODEL` | No | Default: `gemini-2.5-flash` |
| `VITE_API_BASE` | No | Backend URL for frontend; leave empty when using Docker |

---

## API (backend)

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`
- **Admin:** `GET /api/students`, `GET /api/admin/dashboard` (Bearer, admin only)
- **Appointments:** `POST /api/appointments` (admin: book for student, notifies student in-app), `GET /api/appointments` (admin: all; student: own), `PATCH /api/appointments/:id` (admin)
- **Notifications:** `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`
- **Chat:** `POST /api/chat` (Gemini), `POST /api/chat/opening` (first message)
- **Assessment:** `POST /api/assessment` (AI from chat), `POST /api/assessment/form` (form fallback)
- **Voice:** `POST /api/tts` (ElevenLabs TTS), `POST /api/stt` (ElevenLabs Scribe)
- **Health:** `GET /api/health`

---

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for how and where to deploy (VPS, Railway, Render, Fly.io, etc.) and production checklist.
# MoralAi
