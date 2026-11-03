# bucket-list

Backend API for the bucket list app. Node + Express + SQLite (built-in `node:sqlite`, no DB server). Requires Node 22.13+.

## Run

```
npm install
cp .env.example .env     # then fill in JWT_SECRET (and GOOGLE_CLIENT_ID, optional)
npm run dev
npm test
```

## Google sign-in (free)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → *Web application*.
2. Add your frontend origin (e.g. `http://localhost:5173`) under *Authorized JavaScript origins*.
3. Put the client ID in `GOOGLE_CLIENT_ID`.
4. The frontend uses Google Identity Services and POSTs the returned `credential` to `/api/auth/google`.
   `GET /api/auth/config` returns the client ID for the frontend to use.

## API

Auth is an httpOnly cookie, so the frontend must send requests with `credentials: 'include'`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup` | `{email, name, password}` |
| POST | `/api/auth/login` | `{email, password}` |
| POST | `/api/auth/google` | `{credential}` |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | current user |
| GET | `/api/lists` | my lists |
| POST | `/api/lists` | `{title, description?, items?: string[], isPublic?}` |
| GET/PATCH/DELETE | `/api/lists/:id` | PATCH: `{title?, description?, isPublic?}` (isPublic = publish/unpublish) |
| POST | `/api/lists/:id/items` | `{text}` |
| PATCH | `/api/lists/:id/items/:itemId` | `{text?, done?, position?}` |
| DELETE | `/api/lists/:id/items/:itemId` | |
| GET | `/api/public/lists` | community feed: `?page&limit&q&sort=new\|progress&author` |
| GET | `/api/public/lists/:id` | published list (owner can also preview a private one) |

Lists are private until `isPublic: true`. Public responses expose only the author's name and avatar, never email.

## Frontend

React + Vite in `frontend/`. It proxies `/api` to the backend, so run both:

```
npm run dev                  # API on :3000
cd frontend && npm install && npm run dev   # UI on :5173
```

To preview with sample data (separate DB, your real data is untouched): `node --env-file=.env scripts/demo.js`
starts the API on :3001; then `cd frontend` and run Vite with `PORT=5174 API_URL=http://localhost:3001`.
