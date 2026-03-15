/**
 * CSRF Protection Middleware
 *
 * Validates Origin/Referer headers on state-changing requests (POST, PUT, PATCH, DELETE).
 * Skips validation for safe methods (GET, HEAD, OPTIONS) and server-to-server requests.
 */

const { allowedOrigins } = require("../constants/allowedOrigins");

function csrfProtection(req, res, next) {
  // Safe methods don't need CSRF protection
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Server-to-server requests (no origin/referer) — allow if no browser context
  if (!origin && !referer) {
    return next();
  }

  // Check Origin header first (most reliable)
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      return next();
    }
    console.warn(`CSRF blocked: origin "${origin}" not in allowed list`);
    return res.status(403).json({
      success: false,
      error: "Request blocked by CSRF protection",
    });
  }

  // Fallback to Referer header
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.includes(refererOrigin)) {
        return next();
      }
    } catch (_) {
      // Malformed referer
    }
    console.warn(`CSRF blocked: referer "${referer}" not in allowed list`);
    return res.status(403).json({
      success: false,
      error: "Request blocked by CSRF protection",
    });
  }

  return next();
}

module.exports = csrfProtection;
