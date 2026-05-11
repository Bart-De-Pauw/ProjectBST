## Bowling Competition Manager

Monorepo layout:
- `api/`: Go backend (REST API)
- `web/`: React frontend (MUI)
- `infra/`: Docker Compose dev/prod scaffolding

### Production-ish stack (LAN / Raspberry Pi)

```bash
docker compose -f infra/docker-compose.yml up --build
```

The static web container serves the UI on port **5173** (mapped from nginx **80**) and reverse-proxies `/api/` to the Go service, so browsers stay same-origin for `/api/*`.

Postgres is reachable only inside the Compose network (not published on host ports). Change credentials via env overrides before exposing anything wider than your LAN.

Back up the `db_data` volume regularly (`pg_dump`) before upgrades.

### Development (Docker)

Start Postgres + API + Web (dev containers):

```bash
docker compose -f infra/docker-compose.dev.yml up --build
```

Then open:
- Web: `http://localhost:5173`
- Through the web dev proxy: `http://localhost:5173/api/healthz`
- API directly (host port): `http://localhost:8080/healthz`

The browser calls `/api/*`; Vite proxies that to the `api` container (`VITE_DEV_API_PROXY`). Local `npm run dev` defaults the proxy to `http://127.0.0.1:8080`.

After first DB init, a default **President** account exists (from migration `0002_seed_president.sql`):

- Username: `president`
- Password: `changeme`

Change this password immediately in any real deployment.

### HTTP API (overview)

- Health: `GET /healthz`
- Auth: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Players: `GET|POST /players`, `GET|PATCH /players/{id}`, `PUT /profile`
- Teams: `GET|POST /teams`, `GET|PATCH /teams/{id}`
- Seasons & schedule: `POST|GET /seasons`, `GET|PATCH /seasons/{id}` (PATCH is President-only), `GET /seasons/{id}/teams|affiliations|events` (read: any signed-in user), `POST|DELETE /seasons/{id}/teams/{teamId}`, `POST /seasons/{id}/affiliations`, `POST /seasons/{id}/events`
- Teams/players directory (read): `GET /teams`, `GET /players` (any signed-in user; create/update remains President-only)
- Matches: `POST|GET /events/{eventId}/matches`, `PUT /matches/{matchId}/roster`, `POST /matches/{matchId}/scores`, `POST /matches/{matchId}/approve`, `POST /matches/{matchId}/approve/override`
- Finalize: `POST /events/{eventId}/finalize`, `POST /events/{eventId}/reopen`
- Public: `GET /public/events/{eventId}/live`, `GET /public/seasons/{seasonId}/leaderboards?mode=official|live`
- Email stub: `POST /events/{eventId}/send-digest` (returns JSON placeholder until Gmail API is wired)

### Development (local tools)

If you prefer running web locally:

```bash
cd web
npm install
npm run dev
```

And API locally:

```bash
cd api
go test ./...
go run ./cmd/server
```
