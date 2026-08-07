const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const clientId = process.env.YT_CLIENT_ID;
const clientSecret = process.env.YT_CLIENT_SECRET;
const redirectUri = process.env.YT_OAUTH_CALLBACK || 'http://localhost:3000/auth/google/callback';

if (!clientId || !clientSecret) {
  console.warn('YT_CLIENT_ID or YT_CLIENT_SECRET not set. OAuth endpoints will not work until configured.');
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

router.get('/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/yt-analytics.readonly'
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes
  });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');
  try {
    const { tokens } = await oauth2Client.getToken(code);
    // WARNING: for dev only — persist tokens securely in production
    const tokensFile = process.env.TOKENS_FILE || path.join(process.cwd(), 'tokens.json');
    fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));
    res.send('OAuth successful — tokens saved (dev). Remove tokens.json and store securely in production.');
  } catch (err) {
    console.error(err);
    res.status(500).send('OAuth exchange failed');
  }
});

module.exports = router;
