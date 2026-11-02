# Suraya public services — deployment

## What this release provides
- Persian public services page at `/`.
- `GET /api/services` service catalogue.
- `GET /api/status` runtime and order-intake readiness.
- `POST /api/order` validated order intake with PostgreSQL persistence.
- Basic per-IP submission throttling and bounded request payloads.
- No online payment is enabled; displayed prices are indicative and must be confirmed before work begins.

## Required production configuration
Set `DATABASE_URL` in the hosting provider's environment settings to a managed PostgreSQL database. For Render, create a PostgreSQL instance and use its **Internal Database URL** when the web service is in the same region. Do not commit database credentials.

Optional:
- `DATABASE_SSL=true` only if the database endpoint requires TLS.
- `PORT` is normally supplied by the hosting provider.

The application creates the `suraya_orders` table on startup. If `DATABASE_URL` is absent or the database is unavailable, the website remains viewable but order intake stays disabled and returns HTTP 503. The API never reports an order as received unless PostgreSQL confirms the insert.

## Render deployment
1. Create/attach a managed PostgreSQL database.
2. Add `DATABASE_URL` to the web service environment. Prefer the internal connection URL.
3. Set build command to `npm install` and start command to `npm start`.
4. Deploy the branch after reviewing its pull request.
5. Verify `/health`, `/api/status`, and submit a test request. Confirm the row exists in `suraya_orders`.

## Operational boundaries
- Do not enable paid checkout until server-side payment verification and webhook signature validation are implemented.
- Do not collect sensitive identity or payment-card data in the request form.
- Back up the managed PostgreSQL database and restrict database credentials to the web service.
- The in-memory rate limiter is a basic single-instance safeguard, not distributed abuse protection.
