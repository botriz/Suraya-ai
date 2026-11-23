# Suraya deployment preflight

This is the canonical public-services backend. It requires persistent PostgreSQL for order intake; the application applies its database migrations during startup.

## Runtime and health checks

- Node.js 20+
- Container port: 10000 (the host may inject `PORT`)
- `GET /health`: liveness; HTTP 200 while the process is alive
- `GET /ready`: readiness; HTTP 200 only when core PostgreSQL schema is ready, otherwise HTTP 503
- `GET /api/status`: service status and capability flags
- `GET /api/services`: quote-only service catalog

The Docker image runs as the unprivileged `node` user. Do not mount source-control credentials or the Docker socket into the container.

## Required production configuration

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | yes | Set to `production` |
| `PORT` | host-provided | HTTP listener port |
| `DATABASE_URL` | yes for live order intake | PostgreSQL connection string |
| `DATABASE_SSL` | provider-dependent | Set `true` only when PostgreSQL requires TLS |
| `SURAYA_OPERATOR_TOKEN` | yes for operator APIs | Long random bearer token; store as a host secret |

## Optional configuration

| Variable | Purpose |
|---|---|
| `AI_API_KEY` | Enables the content provider |
| `AI_BASE_URL` | OpenAI-compatible API base URL |
| `AI_MODEL` | Model identifier |
| `SURAYA_AGENT_ENABLED` | Must remain `false` unless explicitly approved |
| `SURAYA_AGENT_GITHUB_TOKEN` | Fine-grained token only if the autonomous branch agent is intentionally enabled |
| `SURAYA_AGENT_REPOSITORY` | Must remain `botriz/Suraya-ai` for the guarded agent |
| `SURAYA_AGENT_BASE_BRANCH` | Development base branch for draft PRs |

Never commit secrets or put them in frontend code. The autonomous agent is disabled by default and cannot merge, deploy, or publish.

## Database

Use managed PostgreSQL or a separately operated PostgreSQL service with persistent storage and tested backups. The app creates the base order table and applies:

- `002_revenue_operations.sql`
- `004_autonomous_agent.sql`
- `001_world_foundation.sql` (optional digital-world capability)

CI applies the migrations repeatedly against PostgreSQL 16 to verify idempotency. Back up the database before upgrading and test restoration before public launch.

## Build and verify

```bash
npm install
npm run check
docker build -t suraya-public-services .
docker run --rm -p 10000:10000 \
  -e NODE_ENV=production \
  -e PORT=10000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SURAYA_OPERATOR_TOKEN="$SURAYA_OPERATOR_TOKEN" \
  suraya-public-services
```

Pass real values only through your shell or secret manager. Do not store them in repository files or shared command history.

## Operational limitations

- Payments, social OAuth, automatic publishing, persistent customer accounts, and wallet functionality are not implemented.
- Prices are quote-only until Iran-local prices and currency units are approved.
- The rate limiter is in-memory and suitable only for a single app instance. Multi-instance deployment requires a shared rate-limit store.
- The operator token is a single shared credential, not a full user identity system.
- A successful health check does not mean payment or publishing capabilities are active.

## Host configuration

Use HTTPS termination and one trusted reverse proxy in front of the app. The Express proxy setting assumes exactly one trusted proxy hop. Configure platform liveness to `/health`; use `/ready` for deployment readiness if supported.
