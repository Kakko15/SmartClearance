const supabase = require("../supabaseClient");

/**
 * JWT authentication middleware.
 * Extracts the Supabase access token from the Authorization header,
 * verifies it, and attaches the authenticated user to req.user.
 *
 * Usage:
 *   router.post("/some-route", requireAuth, handler);
 *   router.get("/some-route", optionalAuth, handler);
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.split(" ")[1];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    // Attach authenticated user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
}

/**
 * Optional auth middleware — does not reject unauthenticated requests,
 * but attaches req.user if a valid token is present.
 */
async function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) req.user = user;
    }
  } catch (_error) {
    // Silently continue without auth
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
