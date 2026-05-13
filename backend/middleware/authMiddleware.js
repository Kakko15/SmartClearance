/**
 * @module authMiddleware
 * @description Express middleware for JWT authentication and role-based access control.
 * Uses Supabase Auth to verify Bearer tokens and loads user role from profiles.
 */
const supabase = require("../supabaseClient");

/**
 * Middleware that requires a valid JWT Bearer token.
 * Attaches `req.user` (Supabase user) and `req.userRole` (profile role) on success.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
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

    req.user = user;

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
  } catch (error) {
    console.warn("optionalAuth error (non-blocking):", error.message);
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
