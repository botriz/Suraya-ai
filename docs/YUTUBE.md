# YouTube integration guide for Suraya-ai

This document explains how to enable YouTube Data API access (read-only stats) and how to set up the GitHub Actions workflow for *manual* video uploads using OAuth credentials.

IMPORTANT: do not commit any credentials into the repository. Use GitHub Actions Secrets.

1) Quick: Read-only channel stats (no upload)

- Go to Google Cloud Console: https://console.cloud.google.com/
- Create or select a project.
- In "APIs & Services" → "Library" enable **YouTube Data API v3**.
- In "APIs & Services" → "Credentials" create an API key.
- Add the API key to the repo Secrets as `YT_API_KEY` (recommended) or paste into Admin UI for testing.

2) For programmatic uploads (GitHub Actions)

You must create OAuth 2.0 credentials and extract a refresh token. Steps (one-time):

- In Google Cloud Console → "Credentials" → Create Credentials → OAuth client ID.
  - Application type: Web application
  - Add an authorized redirect URI you control. For an easy local flow you can use `http://localhost:3000/oauth2callback`.
- Note the **Client ID** and **Client secret**.
- Run a simple OAuth flow locally to obtain a refresh token (the workflow here assumes you already have a refresh token). I provide a helper script in `scripts/` to assist.

3) Add the following secrets to your GitHub repository (Settings → Secrets → Actions):

- `YT_CLIENT_ID` — OAuth client ID
- `YT_CLIENT_SECRET` — OAuth client secret
- `YT_REFRESH_TOKEN` — refresh token with upload scope (`https://www.googleapis.com/auth/youtube.upload`)
- `YT_API_KEY` — (optional) for read-only Data API requests

4) How the Workflow works

- The workflow `upload-video.yml` is a `workflow_dispatch` manual workflow. It runs a small Node.js script (`scripts/upload-video.js`) that uses the provided refresh token to obtain an access token and upload the video file placed at `uploads/video.mp4` (you can change the path in the workflow inputs).
- Workflow inputs allow you to set `video_path`, `title`, `description`, `privacyStatus` (public/unlisted/private), and `tags`.

5) Security & operational notes

- Keep client secret and refresh token private. If they are leaked, revoke them immediately from Google Cloud Console and rotate credentials.
- This repository does not store secrets in code. Add them only via GitHub Secrets.
- For production usage consider a more robust upload service with error handling, retry, and content validation.

6) Troubleshooting

- If upload fails with 401: the refresh token is invalid or revoked. Re-run OAuth flow to obtain a fresh refresh token.
- For permission errors ensure the OAuth consent screen and scopes are approved and the Google account used has rights to upload to the channel.

---
Files provided:
- `.github/workflows/upload-video.yml` — manual workflow to upload
- `scripts/upload-video.js` — helper script used by the workflow
- `youtube-integration.js` — client-side helper used by admin UI for read-only stats
