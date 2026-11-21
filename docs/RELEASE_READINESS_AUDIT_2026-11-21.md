# Release-readiness inventory — 2026-11-21

This is an initial repository triage, not a claim that every repository has received a full source-code or security audit. The inventory is based on repository metadata, root listings, READMEs, package manifests, and selected source/test files. Production changes are intentionally limited to the main Suraya application until ownership, dependencies, and intended release roles are clear.

## Release candidates and integration boundaries

| Repository | Initial classification | Release decision |
|---|---|---|
| `botriz/Suraya-ai` | Main deployed Node/Express application with PostgreSQL, public service intake, creator content adapter, operator API, PWA, and digital-world read API. | Primary product repository. Changes go through CI and reviewed PRs; production deployment requires creator approval. |
| `botriz/suraya-global-intelligence-core` | Standalone encrypted state/governance foundation using AES-256-GCM and scrypt, with tamper-detection tests. A draft PR adds a least-privilege package entrypoint; it is not wired into the deployed application. | Candidate for controlled integration after identity/state schema and secret lifecycle are agreed. |
| `botriz/Suraya-Clean` | Experimental Solidity contracts and in-memory chain/world simulator. README explicitly says it is not a production blockchain. | Test-only. No mainnet/token launch until independent audit, adversarial testing, key-management design, and legal review. |
| `botriz/Suraya-Wallet-AI` | Wallet/agent/exchange prototype. Unsafe public mutation endpoints are deliberately blocked with HTTP 503. No durable custody, account auth, or persistent double-entry ledger. | Keep fail-closed. Do not enable real deposits, withdrawals, custody, balances, or exchange. |
| `botriz/SURAYA-AI-core-contracts-types.py` | Personal AI OS architecture/specification and Python project scaffold. | Needs separate implementation and security review before it can be integrated as an executor. |

## Prototype modules that must be redesigned before production

| Repository | Finding | Required work |
|---|---|---|
| `botriz/Behavior-Engine` | Main branch returns fixed activity/growth/revenue scores; a draft PR removes fabricated scores and fails closed with `not_implemented`. | Later replace the placeholder with consented, evidence-backed metrics and a versioned data contract. |
| `botriz/Growth-Engine` | Main branch returns fixed/inflated growth and influence scores; a draft PR removes fabricated metrics and fails closed with `not_implemented`. | Later build real analytics and attribution before exposing growth claims. |
| `botriz/Admin-Panel` | Main branch reports FULL access in a special mode based on core state; a draft PR removes that path and reports no access until authentication exists. | Integrate only behind server-side authentication, RBAC, MFA, scoped permissions, and audit events. |
| `botriz/License-Layer` | Main branch can claim a license is valid without verification; a draft PR changes this to `unverified` and `valid: false`. | Add signed entitlements, expiry/revocation, domain verification, and server-side checks. |
| `botriz/suraya-global-growth-engine.js` | Contains scaffolding/generator code that writes model/config/runtime files; not a deployable service. | Split generators from runtime, validate inputs, persist through approved storage, and remove fabricated analytics. |
| `botriz/Notification-Engine` | Main branch contains a malformed source filename and claims delivery without a provider; a draft PR replaces it with a correctly named fail-closed module and tests. | Add a real provider adapter, consent checks, delivery receipts, and retry policy before sending messages. |
| `botriz/Global-Event-Engine` | A draft PR adds a pure versioned event-envelope schema and payload validation; it deliberately has no persistence or delivery. | Add idempotency, retry/dead-letter policy, and durable transport before production use. |
| `botriz/suraya-global-intelligence-core22` | Snapshot/duplicate of the core filenames without a package manifest or test suite. | Treat as archive/reference; use the tested core repository as the candidate source. |

## Duplicate, experimental, or separately scoped repositories

| Repository | Initial finding | Handling |
|---|---|---|
| `botriz/Botriz` | Private, older Ata/Suraya codebase with overlapping file names but materially different server and package manifests. | Treat as a separate legacy branch; compare its unique features and secrets/configuration before selectively porting anything. Do not deploy it as the production source. |
| `suraya-supercore-js/Suraya-ai` | Older static-site/prototype copy of Suraya. | Archive or document as legacy after confirming no unique production assets are needed. |
| `suraya-supercore-js/-` | Small legacy supercore prototype with local in-memory state and fixed suggestions. | Do not connect to production authority or financial operations. |
| `suraya-supercore-js/-11` | Render webhook example project. | Reference only; requires its own Render plan/webhook setup and is not the Suraya application. |
| `botriz/copilot--` | Separate repository; scope not yet established. | Keep separate until its intended product role is confirmed. |
| `botriz/metamcp` | Separate MetaMCP aggregator/orchestrator codebase, not part of the deployed Suraya runtime. | Do not merge into the Suraya runtime without an explicit dependency, licensing, maintenance, and threat-model review. |
| `botriz/Sources01` | README-only repository. | No release artifact identified. |
| `botriz/betriz-core` and `botriz/Betriz` | Minimal HTML prototypes. | Compare purpose and content; not production services yet. |
| `botriz/betriz-paper-wallet` | README-only repository. | No wallet implementation or release artifact identified. |
| `botriz/Tabriz.Botriz` | Small standalone Python/web prototype. | Keep separate pending dependency, security, and deployment review. |
| `suraya-supercore-js/-` and `suraya-supercore-js/-11` | Organization-owned experimental/reference repositories. | Keep their release lifecycle separate from the main production app. |

## Current production constraints

- The existing Render PostgreSQL database is the source of order/world data and must be preserved. Do not recreate, drop, or migrate it destructively.
- The current free PostgreSQL instance is scheduled to expire on 2026-12-02. The owner must choose a retention/upgrade path before that date; no paid plan is selected by this work.
- The deployed application currently exposes order intake and limited world read APIs. Payments, crypto wallet, persistent user accounts, social OAuth, and automatic publishing remain disabled.
- The content-generation feature requires a provider key configured in Render's secret environment. Never put that key in source control or chat.
- The wallet and smart-contract repositories are prototypes, not production payment infrastructure.
- A Render production deployment must not be triggered by merging code until the owner explicitly approves release.

## Recommended integration order

1. Stabilize and test the main Suraya application.
2. Integrate a bounded, advisory-only central planner; keep execution disabled until identity, permissions, approvals, and audit storage exist.
3. Integrate the encrypted governance core only after secret provisioning, state ownership, backup, and recovery are defined.
4. Rebuild the admin, behavior, growth, license, notification, and event modules against explicit API contracts.
5. Add a real accounting ledger and payment-provider integration only after provider/network selection, legal review, idempotent webhook verification, and operational reconciliation.
6. Treat blockchain, token issuance, and custody as separate gated projects requiring independent review.

## Approval boundaries

No production deploy, database plan change, payment activation, wallet custody, token launch, paid advertising spend, destructive migration, or external account authorization is included in this audit. Each requires a separate explicit approval.


## Draft changes prepared in this review (not merged or released)

- Main Suraya: [PR #39](https://github.com/botriz/Suraya-ai/pull/39) — hardened operator authentication, advisory central planner, tests, and this inventory.
- Behavior Engine: [PR #1](https://github.com/botriz/Behavior-Engine/pull/1) — remove fabricated metrics and add tests/CI.
- Growth Engine: [PR #1](https://github.com/botriz/Growth-Engine/pull/1) — remove fabricated metrics and add tests/CI.
- Admin Panel: [PR #1](https://github.com/botriz/Admin-Panel/pull/1) — fail closed until authentication and role controls exist.
- License Layer: [PR #1](https://github.com/botriz/License-Layer/pull/1) — fail closed until signed license verification exists.
- Notification Engine: [PR #1](https://github.com/botriz/Notification-Engine/pull/1) — replace false delivery claims with a no-send placeholder.
- Global Event Engine: [PR #1](https://github.com/botriz/Global-Event-Engine/pull/1) — add the event-envelope contract only.
- Encrypted core: [PR #2](https://github.com/botriz/suraya-global-intelligence-core/pull/2) — expose only the least-privilege encrypted store API.

All listed pull requests are drafts. Their CI status must be green and they must be reviewed before merging. None of these changes has been deployed to production.
