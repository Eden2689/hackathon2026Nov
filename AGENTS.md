# AI Construction Agents

## Mission
Build a secure, auditable construction-material estimation control plane. User-facing flows must be useful with seeded data, but all state shown in the UI must come from the API and persisted storage.

## Architecture
- `server/`: Express API, authentication, rate limiting, workflow orchestration, approved integrations, and JSON persistence.
- `src/`: Vite + React client. Keep components presentational where possible and use the API client in `src/lib/api.ts`.
- `data/`: runtime state. This directory is intentionally ignored from source control in production deployments.

## Safety invariants
- Never execute arbitrary shell commands or accept arbitrary tool names from clients.
- Sensitive task actions require an explicit confirmation flag and are logged.
- Tool calls must be selected from the allow-list in `server/integrations.ts`.
- Every workflow event must be auditable with a timestamp and actor.
- API input must be validated before it reaches workflow logic.

## Development
```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

The demo account is `admin@buildflow.dev` / `demo1234`.
