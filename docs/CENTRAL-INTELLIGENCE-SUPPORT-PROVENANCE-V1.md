# Suraya Central Intelligence, Support Assistant & Provenance System — v1

Status: architecture specification; not a claim of production implementation.

## Goals
1. One central orchestrator routes user requests to approved service engines.
2. A separate in-product guide/support assistant teaches workflows, diagnoses common errors, and opens traceable support cases.
3. Every generated asset receives verifiable provenance and an attribution record.
4. Creator approval remains mandatory for publishing, external actions, spending, account connections, and other sensitive operations.

## 1. Central intelligence architecture

### Request lifecycle
- Authenticate user and resolve tenant/workspace.
- Normalize language, intent, requested service, constraints, and output format.
- Check policy, permissions, subscription entitlement, quotas, and estimated provider cost.
- Produce a proposed execution plan with named tools and expected outputs.
- Execute only allow-listed tools with scoped credentials and timeouts.
- Validate output against service schema and safety rules.
- Return result, provenance ID, cost/usage record, and next-step suggestions.
- Require explicit confirmation before publish, send, purchase, delete, account changes, or other irreversible/external actions.

### Core modules
- intent-router: classify request and choose service.
- planner: build a bounded plan; no unrestricted shell or arbitrary code execution.
- tool-registry: allow-listed service adapters with per-tool permissions.
- policy-gate: creator/admin approval, user consent, quotas, and action restrictions.
- memory-store: tenant-isolated preferences and conversation summaries with user controls.
- quality-gate: schema, factuality, duplicate, and policy checks.
- audit-ledger: append-only record of plans, approvals, tool calls, and outcomes.
- model-gateway: provider-neutral API adapter; model names and provider capabilities configured centrally.

### Non-negotiable controls
- No self-granted admin rights.
- No secret or API key exposure to browser/client.
- No training on private user content without explicit opt-in.
- No external action without permission and, where sensitive, a fresh confirmation.
- Rate limits, per-user budgets, request timeouts, retries with caps, and circuit breakers.
- Fail closed when auth, entitlement, approval, or provider configuration is missing.

## 2. User guide and support assistant

### Modes
- Guide: onboarding, service discovery, step-by-step help, examples.
- Troubleshooter: collect error code, page, action, time, and non-sensitive diagnostics; compare against a curated runbook.
- Support case: create a ticket with consent, sanitized diagnostic bundle, status, and follow-up history.
- Human escalation: route billing, account access, security, data deletion, disputes, and unresolved failures to a human operator.

### Answer policy
- Retrieve from versioned product docs, current service schemas, and approved troubleshooting articles.
- Cite the relevant help article/version inside the support UI.
- Clearly distinguish known facts from hypotheses.
- Never ask for passwords, API keys, payment card data, or recovery secrets.
- Redact tokens, email addresses, and personal data from diagnostic logs.
- If confidence is low, ask one targeted question or open a support case; do not invent a fix.

## 3. Provenance and attribution system

### Fundamental limitation
No watermark or metadata is impossible to remove. Screenshots, re-encoding, cropping, transcription, and manual recreation can defeat some techniques. Therefore use multiple independent signals and describe the system as tamper-resistant and verifiable, not indelible or guaranteed.

### Asset identity
For every generated deliverable create:
- asset_id: random UUIDv7 or equivalent, globally unique.
- creator_account_id: internal immutable creator identifier (never expose private account data).
- created_at: server timestamp.
- service_id and model/provider identifiers (avoid exposing secrets).
- content_hash: SHA-256 of canonical original bytes.
- parent_asset_id: for edits/derivatives where known.
- license_id: explicit terms selected at generation/purchase.
- manifest_version, signature, and verification_url.

### Layered attribution
1. Signed provenance manifest: canonical JSON manifest signed server-side with Ed25519; public verification key published. Store signature and manifest separately from the media.
2. Visible attribution: optional subtle “Created with Suraya” credit, configurable per license and format.
3. Embedded metadata: C2PA-compatible content credentials or standard metadata where supported; preserve provenance through supported export paths.
4. Robust watermark: modality-specific invisible watermark for supported image/audio/video outputs, with detector version and confidence. Treat as a signal, not sole proof.
5. Content fingerprint: perceptual hashes / audio fingerprints to find likely copies after resizing, compression, or format conversion.
6. Append-only provenance events: generation, export, authorized edit, license grant, verification, and reported infringement events. Use hash chaining and restricted write access; periodically anchor a ledger digest externally if practical.

### Derivative and copy handling
- Every edit generated inside Suraya gets a new asset_id and links to its parent.
- A derivative manifest records transformation type and known parent ID.
- Verification returns: exact match, likely transformed match, or no reliable match; include confidence and evidence.
- External copies discovered by monitoring are leads for review, not proof of infringement.
- Never claim every repost is automatically attributable or that royalties automatically flow back from arbitrary platforms.

### Rights and revenue
A creator's entitlement depends on the applicable license, contracts, platform terms, and enforceable rights. To automate revenue sharing, each distribution partner must support rights metadata, reporting, and a payment/royalty agreement or a platform-specific rights-management integration.
- Record the creator's chosen license and permitted uses at creation.
- Provide a public verification/claim page with evidence and a dispute process.
- Track views/reposts only where an authorized platform API provides reliable metrics.
- Calculate revenue shares only from verified, contractually eligible events.
- Keep a transparent ledger of gross amount, fee, share, adjustments, and payout status.
- Do not promise universal automatic payment from copies on platforms that provide no such mechanism.

## 4. Suggested API surface (v1)
- POST /api/central/v1/plan
- POST /api/central/v1/execute (requires plan token and policy checks)
- POST /api/support/v1/chat
- POST /api/support/v1/cases
- GET /api/support/v1/cases/:id
- POST /api/provenance/v1/assets
- GET /api/provenance/v1/assets/:assetId
- POST /api/provenance/v1/verify
- POST /api/provenance/v1/claims

All endpoints require authentication, tenant isolation, schema validation, rate limits, and audit events. Public verification endpoints reveal only licensed public metadata, never private user identifiers or internal prompts.

## 5. Delivery sequence

### Phase A — safe foundations
- Data model and migrations for assets, manifests, lineage, licenses, support cases, and audit events.
- Server-side signing key held in secret manager; rotation and key IDs.
- Deterministic manifest canonicalization and signature verification tests.
- Central router with a single existing content-generation adapter.
- Support assistant grounded in versioned help docs with human escalation.

### Phase B — media protection
- Add visible credit and embedded metadata to supported exports.
- Integrate watermark/fingerprint providers per media type.
- Build verification UI and false-positive review workflow.
- Add derivative lineage for in-product edits.

### Phase C — rights and revenue
- Integrate one platform/partner at a time after API and legal capability review.
- Add rights claims, dispute handling, verified analytics, and payout reconciliation.
- Never activate royalty payments until agreements, accounting, and compliance are approved.

## 6. Acceptance criteria
- All privileged actions are permission-checked and auditable.
- No tool execution can bypass the approval gate.
- Support answers are grounded in current docs and can escalate.
- Every generated asset has a unique ID, canonical hash, signed manifest, license, and lineage fields.
- Modified assets are reported as probable matches with confidence, not falsely declared exact.
- Tests cover manifest tampering, key rotation, missing keys, duplicate requests, tenant isolation, rate limits, and support escalation.
- UI and APIs disclose the limitations of watermarking and cross-platform royalty collection.
