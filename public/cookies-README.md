# Cookie module

This change adds a lightweight cookie-consent system and client banner to the project.

Files added:
- src/cookies/index.js      (sign/verify helpers)
- src/cookies/middleware.js (express middleware to parse consent cookie)
- src/cookies/routes.js     (endpoints: POST /api/cookies/consent, GET /api/cookies/settings, POST /api/cookies/revoke)
- public/assets/js/cookie-consent.js
- public/assets/css/cookie-consent.css
- package.json updated to include cookie-parser

Env vars (add to .env):
- COOKIE_SIGNING_KEY=replace_with_secure_random
- COOKIE_NAME=cookie_consent (optional)
- CONSENT_LOG_PATH=./data/consents.log (optional)

Usage:
- Start the API and worker (see README in root). The public page will show the consent banner when no cookie exists.
- The consent endpoint writes a signed cookie and logs consent server-side for compliance.

Security notes:
- Replace COOKIE_SIGNING_KEY with a secure random value in production and store it in a secret manager.
- Move consent logs to a proper DB for production use rather than a flat file.
