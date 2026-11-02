# Suraya Digital World API v1

Base path: `/api/world/v1`

This is a read-only foundation API. It exposes public world metadata and approved public events. No endpoint creates users, characters, assets, transfers, payments, or simulation actions.

## Endpoints

- `GET /status` — API version, foundation stage, and storage readiness.
- `GET /manifest` — public world manifest, language defaults, planned first city, and disabled capabilities.
- `GET /events?limit=20` — public events only; limit is clamped to 1–50. Returns 503 when world storage is unavailable.

## Storage

Migration `migrations/001_world_foundation.sql` is additive and idempotent. It creates:
- `world_regions`: hierarchical regions with draft/review/published lifecycle.
- `world_events`: versioned append-oriented events with actor attribution, visibility, and idempotency key.
- `world_environment_layers`: versioned terrain, climate, water, ecology, resources, and weather datasets with review status.
- `world_schema_migrations`: applied migration versions.

No geography or climate facts are seeded by this migration. Datasets must be sourced, licensed, reviewed, and versioned before publication.

## Safety boundary

All current endpoints are read-only. Character execution, registration, wallets, virtual ledger transfers, and real payments remain disabled. Before adding write endpoints, implement authentication, role-based authorization, scoped expiring capabilities, CSRF protections where cookie auth is used, audit records, idempotency, rate limits, operator revocation, and human approval for sensitive actions.
