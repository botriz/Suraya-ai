# Suraya product and revenue expansion — v1

## World observatory
- `/world/observatory.html` is a public, read-only visual cockpit.
- The globe is explicitly schematic, not a factual map. It must not imply that unverified geography, climate, population, or citizen data exists.
- Status and public events are fetched from `/api/world/v1`; refresh is periodic and failures are visible.
- Layer toggles are presentation controls until verified datasets and map tiles are integrated.
- Next: adopt a licensed geographic source, store WGS84 / EPSG:4326 geometry, publish reviewed datasets, then render actual map tiles and time/environment layers.

## Paid service catalogue
Current orderable service codes:
- `social_content`, `business_content`, `product_descriptions`: one-off content packages.
- `social_monthly`: monthly social-content operations, with customer-approved publishing only.
- `subscription_ops`: monthly subscription operations support; no handling of customer passwords or payment credentials.
- `store_launch`: one-off store content launch package.

Prices are indicative USD list prices, not payment authorization or a promise of delivery capacity. Confirm scope, revisions, deadlines, taxes, and payment method with each customer before work begins. Online payment remains disabled.

## Sales operations — next gates
1. Add authenticated operator CRM: lead, quote, accepted scope, production status, delivery, revision, invoice status.
2. Add a customer portal with order tracking and file delivery.
3. Add recurring billing only after a compliant payment provider, signed webhooks, idempotency, refunds, cancellation and reconciliation are implemented.
4. Add publishing integrations only through official APIs and customer-granted scoped permissions; never request social account passwords.
5. Measure qualified leads, conversion, average order value, delivery time, revision rate, repeat purchase and gross margin.

## Subscription-management product boundary
The service currently means operational planning and reporting. It does not imply access to third-party subscription accounts, automated charge collection, or payment processing.

## Digital citizen extraction and future ledger
Do not create real citizens or tradable assets in this release. Next foundations should be:
- deterministic scheduled generation jobs with quotas, pause/resume, idempotency and immutable audit events;
- identity registry with unique IDs, versioned identity claims, provenance, revocation and privacy controls;
- agent capability registry with read/propose/execute separation, sandbox, budgets, rate limits, approvals and kill switch;
- ledger specification and test network only after independent threat model, supply policy, validator/operator model, recovery and legal review.

No proof-of-work. No price promises. Virtual ledger balances remain distinct from real money and external exchange listings.
