# Botriz / Ata / Ana Unified Ecosystem Roadmap

Status: architecture and staged delivery plan. This document does not claim that a blockchain, token, wallet, mining network, or virtual world is already deployed.

## Product boundary
Suraya is the first revenue-generating service layer. Ata is the central orchestration and governance layer. Ana is the wallet/accounting layer. The future ledger/network and digital world are separate bounded services connected through stable APIs and identity, not a single tightly coupled application.

## Shared platform foundations
- Identity: one account identity, optional MFA/passkeys, recovery flows, role-based access, tenant isolation.
- Authorization: explicit scopes, least privilege, creator-owned root administration, time-bound delegated permissions.
- Service registry: versioned APIs and capabilities for Suraya, Ata, Ana, provenance, support, and future world services.
- Event backbone: versioned events with idempotency keys, retries, dead-letter handling, and audit correlation IDs.
- Data boundaries: each service owns its data; cross-service access through authenticated APIs/events only.
- Observability: structured logs, metrics, traces, health checks, incident history, and cost dashboards.
- Financial ledger: double-entry accounting for fiat balances, internal credits, fees, refunds, and future token transactions. Never treat a UI balance as money without reconciled ledger entries.
- Security: secret manager, key rotation, encryption in transit/at rest, backups, restore drills, threat modeling, and independent security review before handling funds.

## Service responsibilities

### Ata — central intelligence and governance
- Routes requests to approved services and model providers.
- Plans work, checks permissions and quotas, validates outputs, and records audit events.
- Requests creator approval for publishing, transfers, spending, key changes, deployments, and irreversible actions.
- Cannot grant itself privileges or move funds.

### Suraya — services and revenue
- Creator tools, content production, websites, business workflows, customer support, and future service marketplace.
- Each output receives provenance metadata and a license record.
- Revenue and subscription events are sent to the accounting service; Suraya does not invent balances.

### Ana — wallet and accounting
- Start with a non-custodial or ledger-only prototype and clear distinction between test balances and real assets.
- Separate fiat accounting, platform credits, and blockchain assets.
- Transfers require authentication, risk checks, confirmation, idempotency, limits, and audit.
- No private keys or seed phrases sent to AI models or stored in ordinary application logs.
- Custody, exchange, fiat on/off ramps, and payments require jurisdiction-specific legal/compliance review and suitable providers.

### Future ledger / network
- Do not launch a new coin or blockchain before the use case, threat model, consensus, validator economics, governance, and security assumptions are specified.
- First build a local testnet and formal protocol specification; then independent review, adversarial testing, testnet, and only later a carefully governed mainnet.
- Do not describe proof-of-work mining as a revenue guarantee. Mining economics depend on hardware, electricity, difficulty, token value, and network security.
- If a token is needed, define utility, issuance, supply schedule, fee model, governance, and redemption/transfer constraints before deployment.
- Prefer interoperable standards and audited components over inventing cryptography or consensus.

### Digital world
- Treat as a later client/service using shared identity, asset provenance, permissions, and wallet interfaces.
- Separate world simulation and user-generated content from financial settlement.
- Define moderation, safety, asset ownership, portability, and server costs before public launch.

## Event contracts
Use versioned events such as:
- identity.user.created.v1
- suraya.asset.generated.v1
- provenance.manifest.signed.v1
- support.case.opened.v1
- billing.invoice.issued.v1
- billing.payment.confirmed.v1
- ana.ledger.entry.posted.v1
- ana.transfer.requested.v1
- world.asset.minted.v1 (only after ledger and legal design approval)

Events must contain opaque IDs, timestamps, schema version, correlation ID, and minimal necessary data. Never place secrets, seed phrases, full payment credentials, or private prompts in event payloads.

## Build sequence — revenue before protocol risk

### Stage 0 — stabilize the current product
- Verify current deployment, service routes, database migrations, provider errors, mobile UI, and backups.
- Fix broken links, inaccessible controls, empty states, validation, and error reporting.
- Add product analytics with privacy notice and consent controls.
- Keep operating cost within explicit budgets.

### Stage 1 — make one service sellable
- Choose one narrow high-value service (initially creator content package).
- Show a real demo, sample output, transparent scope, turnaround, revision policy, and invoice.
- Add customer request records, operator workflow, support channel, and manual fulfillment.
- Validate willingness to pay with real users before building broad subscription tiers.

### Stage 2 — Ata and support
- Integrate the central router with existing service APIs.
- Add policy/approval gates, tool registry, audit log, quotas, and provider abstraction.
- Launch a documentation-grounded guide/support assistant and human escalation.

### Stage 3 — provenance and creator rights
- Add signed manifests, content hashes, lineage, licenses, verification page, and supported watermark/fingerprint adapters.
- Add infringement reports and dispute handling.
- Track third-party reach or royalties only with authorized APIs and enforceable partner agreements.

### Stage 4 — Ana accounting and wallet prototype
- Build double-entry internal ledger and invoice reconciliation first.
- Use test balances and a sandbox environment; clearly label them.
- Threat model, audit, and legal review before real custody or transfers.

### Stage 5 — ledger / token testnet
- Publish a protocol design and threat model.
- Benchmark existing chains and decide whether a new chain is genuinely necessary.
- Build a private testnet, validator operations, explorer, faucet, monitoring, and independent security review.
- Mainnet and any sale/marketing of a token require explicit governance and compliance approval.

### Stage 6 — digital world
- Prototype a small useful environment with identity, creator assets, access controls, moderation, and cost limits.
- Integrate wallet/ledger only after their security and governance gates pass.

## Release gates
No stage advances solely because code compiles. Required gates:
- Automated tests and CI green.
- Security and privacy review appropriate to risk.
- Backup and rollback plan.
- Measured operating cost and capacity.
- Clear user-facing terms and limitations.
- Human approval for financial, legal, security-sensitive, and irreversible changes.
- Production monitoring and incident response.

## Success measures
- Time to first useful result and task completion rate.
- Paid conversion, repeat purchase, refund rate, and contribution margin.
- Support resolution time and escalation rate.
- Generation success rate, cost per successful output, and latency.
- Provenance verification precision and false-positive rate.
- Ledger reconciliation accuracy and zero unexplained balance differences.
- Service uptime, recovery time, and security incident rate.
