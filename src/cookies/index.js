const crypto = require('crypto');

const COOKIE_KEY = process.env.COOKIE_SIGNING_KEY || 'change-me-please';
const COOKIE_NAME = process.env.COOKIE_NAME || 'cookie_consent';

function signPayload(payload) {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64');
  const sig = crypto.createHmac('sha256', COOKIE_KEY).update(b64).digest('base64');
  return `${b64}.${sig}`;
}

function verifySigned(signed) {
  if (!signed) return null;
  const parts = String(signed).split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = crypto.createHmac('sha256', COOKIE_KEY).update(b64).digest('base64');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

module.exports = { COOKIE_NAME, signPayload, verifySigned };
