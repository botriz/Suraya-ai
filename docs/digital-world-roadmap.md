# Suraya Digital World — Foundation Roadmap

## Product boundary
The digital world is a distinct product bounded by versioned APIs. It may integrate with Suraya services and ANA later, but neither payment infrastructure nor the public-services runtime is a dependency of the world simulation core.

## Build sequence
1. Nature and environmental primitives (terrain, climate, ecology, resources).
2. World clock, calendar, time zones and deterministic event scheduling.
3. Geographic coordinate system, regions and map tiles.
4. Environmental and simulation rules with reproducible versioning.
5. Tabriz as the first planned city after the world substrate is stable.
6. Visitor identities and consent-based profiles.
7. Character runtime only after the permission, audit and sandbox controls below pass review.

## Audience surfaces
- Visitors / future citizens: orientation, culture, world rules and later onboarding.
- Creators: licensed content, places, narratives and virtual assets.
- Businesses: verified listings and event/service integrations.
- Developers: API contracts, events, security and simulation tools.

## Character-agent control plane (not enabled)
Every character tool must be registered in an allowlist and receive a scoped, expiring capability. Separate read, propose and execute permissions. Default to read/propose; sensitive actions (payments, transfers, publishing, deleting, identity changes, external messages and account access) require explicit human approval. Provide immediate revocation, per-agent budgets, rate limits, sandboxing, audit trails and rollback where possible. Never expose passwords, API keys, private keys or raw payment credentials to character runtimes.

## Ledger and economy boundary
The virtual ledger is separate from real-money accounting. Virtual assets are not automatically redeemable or physical goods. Define issuance caps, sinks, anti-inflation policy, provenance, dispute handling and audit before enabling transfers. No price or return promises.

## Privacy and cookies
Essential consent state only; analytics and personalization remain off until opt-in. No advertising trackers. Store the minimum preference state, document retention, and provide a way to withdraw optional consent. Do not put identity secrets or sensitive profile data in browser cookies.

## Reliability and operations
Use PostgreSQL migrations, versioned APIs, an event outbox/queue, idempotency keys, health checks, structured logs, metrics, backups, staging, CI, deployment gates and rollback. Keep the simulation deterministic where practical and use low-energy consensus/settlement designs; no proof-of-work mining.

## Activation gates
Do not activate registration, wallets, real payments or autonomous character execution until threat modeling, integration tests, access-control review, data-retention policy, operator controls and recovery procedures are complete.
