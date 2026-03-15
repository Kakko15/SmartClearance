/**
 * Shared allowed origins list — used by CORS and CSRF middleware.
 * Single source of truth to prevent drift between configurations.
 */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

module.exports = { allowedOrigins };
