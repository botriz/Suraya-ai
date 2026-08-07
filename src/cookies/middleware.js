const { COOKIE_NAME, verifySigned } = require('./index');

// Express middleware to parse consent cookie and attach req.consent
function cookieConsentMiddleware(req, res, next) {
  const signed = req.cookies && req.cookies[COOKIE_NAME];
  const consent = verifySigned(signed) || null;
  req.consent = consent;
  next();
}

// Helper to set cookie (non-HttpOnly, readable by client)
function setConsentCookie(res, signedValue) {
  const oneYear = 1000 * 60 * 60 * 24 * 365;
  res.cookie(COOKIE_NAME, signedValue, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: oneYear
  });
}

module.exports = { cookieConsentMiddleware, setConsentCookie };
