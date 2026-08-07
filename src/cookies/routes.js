const express = require('express');
const fs = require('fs');
const path = require('path');
const { signPayload } = require('./index');
const { setConsentCookie } = require('./middleware');

const router = express.Router();
const CONSENT_LOG = process.env.CONSENT_LOG_PATH || path.join(process.cwd(), 'data', 'consents.log');

function ensureDataDir() {
  const dir = path.dirname(CONSENT_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendLog(entry) {
  ensureDataDir();
  fs.appendFileSync(CONSENT_LOG, JSON.stringify(entry) + '\n');
}

// POST /api/cookies/consent
router.post('/consent', (req, res) => {
  const { analytics = false, marketing = false, preferences = false } = req.body || {};
  const consent = {
    analytics: !!analytics,
    marketing: !!marketing,
    preferences: !!preferences,
    required: true,
    ts: Date.now()
  };
  const signed = signPayload(consent);
  setConsentCookie(res, signed);

  // log for compliance
  const entry = {
    ip: req.ip,
    ua: req.get('user-agent') || null,
    consent,
    path: req.path,
    created_at: new Date().toISOString()
  };
  try { appendLog(entry); } catch (e) { console.error('consent log failed', e); }

  res.json({ ok: true, consent });
});

// GET /api/cookies/settings
router.get('/settings', (req, res) => {
  // client can read cookie directly, but server returns verified settings too
  const signed = req.cookies && req.cookies[process.env.COOKIE_NAME || 'cookie_consent'];
  let consent = null;
  try {
    const { verifySigned } = require('./index');
    consent = verifySigned(signed);
  } catch (e) { consent = null; }
  res.json({ consent });
});

// POST /api/cookies/revoke
router.post('/revoke', (req, res) => {
  // clear cookie and log
  res.clearCookie(process.env.COOKIE_NAME || 'cookie_consent');
  const entry = { ip: req.ip, ua: req.get('user-agent') || null, action: 'revoke', created_at: new Date().toISOString() };
  try { appendLog(entry); } catch (e) { console.error('consent log failed', e); }
  res.json({ ok: true });
});

module.exports = router;
