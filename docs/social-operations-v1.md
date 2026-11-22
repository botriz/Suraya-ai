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


## Persistent operations foundation (v1)

Migration `003_social_operations.sql` adds:
- social account connection records with status/scope metadata; access tokens are never returned by the API
- persistent posts with review states and idempotency fields
- verified-source audience snapshot storage and operator-defined audience segments
- a persistent PostgreSQL editorial calendar
- a job queue schema and append-only operational audit events
- subscription plan catalogue and customer subscription records

Protected API routes under `/api/social/v1` use the existing `SURAYA_OPERATOR_TOKEN` bearer authorization:
- `GET /overview`, `GET /accounts`, `POST /accounts/:platform/connect`
- `GET|POST /posts`, `POST /posts/:publicId/approve`, `POST /posts/:publicId/schedule`
- `GET|POST|DELETE /calendar`
- `GET|POST /segments`, `GET /audit`, `GET /plans`

The operator token is entered only for the current page session and is not written to browser storage. OAuth connection deliberately fails closed until the platform's reviewed adapter, redirect flow, scopes, encrypted token storage and revocation handling exist. A configured client ID alone does not enable publishing. Scheduling returns an explicit unavailable response until a connected account and a verified publishing adapter are both available.

The four plan definitions (Starter, Creator, Pro, Agency) currently define proposed monthly limits and feature flags. They are catalogue data only: no payment provider, customer login, subscription activation, entitlement enforcement, or charge is enabled. Prices must be reviewed before commercial launch.

Audience segments store operator-defined criteria only. Real audience metrics and targeting remain disabled until official read scopes, platform policy review, user consent, retention limits and data-deletion flows are implemented. No scraping, inferred sensitive traits, or fabricated metrics are used.

The job queue schema is present for the next worker phase; no worker claims jobs and no automatic post publishing or live-stream control is enabled in this release.


## Provider adapters and configuration

Implemented account authorization adapters:
- Meta (Facebook Pages and Instagram professional accounts): `SOCIAL_META_CLIENT_ID`, `SOCIAL_META_CLIENT_SECRET`, `SOCIAL_META_API_VERSION`
- YouTube / Google OAuth: `SOCIAL_YOUTUBE_CLIENT_ID`, `SOCIAL_YOUTUBE_CLIENT_SECRET`
- TikTok OAuth: `SOCIAL_TIKTOK_CLIENT_KEY`, `SOCIAL_TIKTOK_CLIENT_SECRET`
- X OAuth 2.0 with PKCE: `SOCIAL_X_CLIENT_ID`, `SOCIAL_X_CLIENT_SECRET`
- Telegram Bot API: `SOCIAL_TELEGRAM_BOT_TOKEN`, `SOCIAL_TELEGRAM_CHAT_ID`

Shared server configuration:
- `SURAYA_PUBLIC_BASE_URL`: public HTTPS origin, for example `https://ata-ai.onrender.com`
- `SURAYA_SOCIAL_TOKEN_ENCRYPTION_KEY`: exactly 32 bytes encoded as base64 (or 64 hex characters). Generate and store it only in the Render environment settings; never paste it into chat or browser fields.

Register these exact callback paths with each provider:
- `/api/social/v1/oauth/instagram/callback`
- `/api/social/v1/oauth/facebook/callback`
- `/api/social/v1/oauth/youtube/callback`
- `/api/social/v1/oauth/tiktok/callback`
- `/api/social/v1/oauth/x/callback`

OAuth state values are single-use, hashed in PostgreSQL and expire after ten minutes. X authorization uses PKCE. Provider tokens are encrypted using AES-256-GCM before storage; API account listings never return token ciphertext. The current callback implementation exchanges tokens and verifies the selected provider profile/page/channel before marking an account connected.

Telegram connection validates the bot using `getMe`, the destination using `getChat`, and bot membership/administrator permissions using `getChatMember`. Telegram is the only live publishing adapter in this phase. Approved Telegram posts can be scheduled into the PostgreSQL queue and published by the worker. A publish attempt is not automatically retried after an uncertain result, to avoid duplicate posts; such cases are marked failed for manual verification.

Facebook/Instagram, YouTube, TikTok and X authorization are implemented, but their publishing/analytics adapters are not yet enabled. Snapchat, WhatsApp Business, Rubika and Eitaa still need separate provider approval and adapters. Connecting one provider does not grant access to the others.


## Verified audience snapshots

The operator can request a fresh aggregate snapshot for connected Meta, YouTube, TikTok and X accounts through `POST /api/social/v1/accounts/:id/insights/sync`, and read stored history through `GET /api/social/v1/accounts/:id/insights`. The API records the provider source and capture time with a verified flag only after a successful authenticated provider response. Available metrics vary by platform and granted scopes; unavailable demographic reports are omitted rather than fabricated. The current implementation stores aggregate channel/profile statistics and YouTube age-group/gender viewer percentages where the provider returns them. It does not scrape followers, identify individuals, infer sensitive traits or automatically target people.


## Publishing adapter coverage

The queue worker currently supports:
- Telegram: text, image and video through Bot API, after bot/destination verification.
- Facebook Pages: text, image and video through Meta Graph API.
- Instagram professional accounts: image and Reels publishing through Meta media containers, including processing-state polling.
- YouTube: resumable video upload through the YouTube Data API. Media must be served from a host explicitly listed in `SURAYA_MEDIA_ALLOWED_HOSTS`; Google access tokens are refreshed with the stored refresh token.
- TikTok: video direct-post through Content Posting API using `PULL_FROM_URL`; the media host must exactly match `SOCIAL_TIKTOK_MEDIA_DOMAIN` and be verified in the TikTok developer app.
- X: text-only posts up to 280 characters through API v2. Media upload is not enabled.

All publishing requires an approved post and a connected account. A job is attempted once; ambiguous failures are marked failed for manual verification rather than retried automatically. The worker claims jobs with PostgreSQL `SKIP LOCKED` and records provider results and audit events. Do not treat a queued post as published.

Additional Render environment settings:
- `SURAYA_MEDIA_ALLOWED_HOSTS`: comma-separated exact hostnames from which the server may fetch YouTube video sources.
- `SOCIAL_TIKTOK_MEDIA_DOMAIN`: exact hostname verified in the TikTok developer application for URL-pull publishing.

The app currently accepts public HTTPS media URLs; it does not yet upload files from a user's device into object storage or render a new clip. The creator model generates copy and a script, not a rendered video file.


## Source-grounded research workflow

The creator API includes a protected `POST /api/creator/v1/research-draft` endpoint. It requires the operator bearer token, `AI_API_KEY`, and `TAVILY_API_KEY`. The search results are filtered through category-specific domain allowlists for general topics, science, health, law, finance and technology. At least two independent allowed domains are required. The content model receives only the filtered source excerpts as untrusted data and must cite at least two sources inline using numbered references. The research run and exact generated draft are stored in PostgreSQL.

For science, health, law and finance categories, the post API requires a valid research run. The post must match the stored generated title, caption, hashtags and script exactly, and the approval API checks the stored source-policy result before allowing approval. If the editor changes those fields, the research draft must be regenerated. This prevents a client from attaching unrelated citations to rewritten claims.

The allowlist validates source domains, not the truth of every statement on a page. Search snippets may be incomplete or outdated; editors must open and review sources, publication dates and context before approval. Health, legal and financial content remains informational and requires qualified human review. The system does not claim omniscience or guarantee that all scientific facts are correct.

Required Render variable: `TAVILY_API_KEY`. No search or model key is embedded in browser code.


## Direct media upload

The social workspace supports browser-to-S3-compatible object storage uploads using short-lived SigV4 presigned PUT URLs. The API stores upload metadata, verifies the resulting public object with a HEAD request, and only then exposes its HTTPS URL for attachment to a post. Supported MIME types are JPEG, PNG, WebP, MP4, QuickTime MOV, WebM and MPEG video; the maximum size is 500 MB. The presigned URL expires after five minutes. Storage credentials remain server-side.

Required Render variables:
- `SURAYA_S3_ENDPOINT`: root HTTPS endpoint (for example the Cloudflare R2 S3 endpoint; no path prefix)
- `SURAYA_S3_BUCKET`
- `SURAYA_S3_REGION` (use the region expected by the S3-compatible provider)
- `SURAYA_S3_ACCESS_KEY_ID`
- `SURAYA_S3_SECRET_ACCESS_KEY`
- `SURAYA_S3_PUBLIC_BASE_URL`: HTTPS public/CDN base URL serving uploaded objects

Configure bucket CORS to allow PUT from the Suraya site origin with the Content-Type header, and configure public read access (or an equivalent CDN) so the social platform can fetch the media URL. Do not expose S3 credentials in the browser. Uploading media is separate from rendering a new clip; the app still needs a video-generation provider integration to create clips automatically.
