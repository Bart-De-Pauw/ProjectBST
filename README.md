## Bowling Competition Manager

Monorepo layout:
- `api/`: Go backend (REST API)
- `web/`: React frontend (MUI)
- `infra/`: Docker Compose dev/prod scaffolding

### Development (Docker)

Start Postgres + API + Web (dev containers):

```bash
docker compose -f infra/docker-compose.dev.yml up --build
```

Then open:
- Web: `http://localhost:5173`
- API health: `http://localhost:8080/healthz`

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
