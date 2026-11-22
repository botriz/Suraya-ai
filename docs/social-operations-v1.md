# Suraya Social Operations — v1

## Product placement
The social-media manager is a first-class service inside the Suraya service catalogue:
- Service code: `social_monthly`
- Existing one-off companion: `social_content`
- Workspace: `/social-studio.html`
- Public entry points: the service selector and Products & Services catalogue on `/`.

This consolidates the earlier ShebekeMudir, ShabakeWorker, YaziChay and Bərəkətçi concepts into one customer-facing workspace. Their useful workflows are retained, but their legacy implementation is not reused as an authority or execution layer.

## Workspace modules
1. Overview and actual service health.
2. Ten social platform targets: Instagram, YouTube, Telegram, Rubika, Facebook, X, TikTok, Snapchat, WhatsApp and Eitaa.
3. Content studio using `POST /api/creator/v1/draft` for supported targets (Instagram, YouTube, Rubika, Telegram, LinkedIn).
4. Editorial calendar, explicitly local to the current browser in this release.
5. Analytics placeholder; no fabricated audience, reach, engagement or revenue.
6. Central health/capability view using `/api/status` and `/api/capabilities`.

## Current release boundaries
- Account connection and automatic publishing remain disabled until official platform APIs/OAuth, customer-granted scopes, encrypted server-side token storage, revocation and audit logging are implemented.
- No platform passwords are requested or stored.
- Draft generation fails closed if `AI_API_KEY` is not configured; provider configuration is performed only in the hosting environment.
- Editorial plans are browser-local, not synced to the account or database and do not trigger publishing.
- Analytics and income are not populated with simulated values.
- The UI does not expose arbitrary server repair, shell execution, deployment, financial transfer or account-management actions.

## Central AI control model
Future operator integration must use a deterministic tool registry with read/propose/execute permissions, short-lived scoped capabilities, per-action budgets, rate limits, idempotency, immutable audit events, staging validation and rollback. High-risk actions (publishing, deleting content, changing account permissions, payments, transfers, changing secrets or deploying infrastructure) require explicit owner approval. A failed check should create a diagnosis and a proposed remediation; it must not claim a repair occurred unless the operation and post-check both succeed.

## Next implementation gates
1. Durable authenticated social workspace and PostgreSQL-backed editorial calendar.
2. Official OAuth/API adapters per platform, starting with the first customer-approved targets.
- Campaign brief inputs: audience, objective and brand voice are validated by the server and passed to the content engine as untrusted data; the model is instructed not to treat brief text as system instructions.\n3. Approval queue and scheduled job worker with idempotency, retries, dead-letter handling and kill switch.
4. Read-only analytics adapters with provenance and timestamps.
5. Central operator integration for health diagnostics and safe, tested remediations.
6. Independent security review before enabling account write scopes or publishing.


## Central operations dashboard
- Read-only overview: `/control-center.html`.
- It consumes `/api/status`, `/api/capabilities` and `/api/services` and reports the current server-declared state.
- It derives transparent diagnostic notes from disabled capabilities; it does not execute repairs or imply that an AI agent is already authorized to change production.
- The page is linked from the Products & Services workspace and the Social Operations workspace.
