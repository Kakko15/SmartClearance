const supabase = require("../supabaseClient");

/**
 * JWT authentication middleware.
 * Extracts the Supabase access token from the Authorization header,
 * verifies it, and attaches the authenticated user to req.user.
 * Also fetches the user's profile and attaches it to req.profile.
 *
 * Usage:
 *   router.post("/some-route", requireAuth, handler);
 *   router.get("/some-route", optionalAuth, handler);
 *   router.post("/admin-route", requireAuth, requireRole("librarian", "super_admin"), handler);
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

    // Fetch profile with role for downstream role checks
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    req.userRole = profile?.role || null;

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
 * Role-checking middleware factory.
 * Must be used AFTER requireAuth (which sets req.userRole).
 *
 * Usage:
 *   router.post("/library/approve", requireAuth, requireRole("librarian"), handler);
 *   router.post("/admin-route", requireAuth, requireRole("super_admin", "system_admin"), handler);
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action",
      });
    }
    next();
  };
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

module.exports = { requireAuth, requireRole, optionalAuth };
