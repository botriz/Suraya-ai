# YouTube & Payments automation skeleton

This branch provides a minimal skeleton to begin implementing the automated channel management and payments flows.

Files included:
- src/index.js — Express app and route registration
- src/routes/auth.js — Google OAuth2 start / callback (development version)
- src/routes/upload.js — API endpoint to enqueue uploads
- src/topic-checker.js — simple rule-based topic enforcement sample
- worker.js — job worker that processes upload jobs
- .env.example — required environment variables

IMPORTANT
- This is a developer skeleton. **Do not** store production secrets in files. Use a secret manager (Vault / AWS/GCP secret manager) in production.
- You (or an authorised representative) must create Google Cloud credentials (OAuth client) and complete verification and AdSense steps. See docs below.

Quickstart (local)
1. Copy `.env.example` to `.env` and fill values.
2. npm install
3. Start Redis (local) and set REDIS_URL in .env
4. npm start (API) and in another terminal npm run worker (job worker)

Google Cloud notes
- Create a Google Cloud project, enable YouTube Data API and YouTube Analytics API.
- Create OAuth 2.0 Client ID (Web application) and add redirect URI: `http://localhost:3000/auth/google/callback` (or your production callback).
- Scopes used: `https://www.googleapis.com/auth/youtube.upload`, `https://www.googleapis.com/auth/youtube`, `https://www.googleapis.com/auth/yt-analytics.readonly`

Security & production
- Use an encrypted DB or Secret Manager for tokens.
- Use HSM/custody solutions for production wallets (do not store private keys in repo/servers unencrypted).

