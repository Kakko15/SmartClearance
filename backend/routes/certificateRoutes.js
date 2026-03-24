const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const supabase = require("../supabaseClient");
const { requireAuth } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");
const { isStaffRole, isManagementRole } = require("../constants/roles");
const {
  generateCertificate,
  verifyCertificate,
} = require("../services/certificateService");

const isDev = process.env.NODE_ENV !== "production";
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many verification attempts. Please try again later.",
  },
});
const certificateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many certificate requests. Please try again later.",
  },
});

router.post("/generate", certificateLimiter, requireAuth, async (req, res) => {
  try {
    const { request_id } = req.body;
    const user_id = req.user.id;

    const { data: request, error: reqError } = await supabase
      .from("requests")
      .select("*, profiles!requests_student_id_fkey(role)")
      .eq("id", request_id)
      .single();

    if (reqError || !request) {
      return res.status(404).json({
        success: false,
        error: "Request not found",
      });
    }

    if (!request.is_completed) {
      return res.status(400).json({
        success: false,
        error: "Request is not completed yet",
      });
    }

    const userRole = req.userRole;

    const isOwner = request.student_id === user_id;
    const isAdmin =
      isStaffRole(userRole) || isManagementRole(userRole);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to generate certificate for this request",
      });
    }

    const result = await generateCertificate(request_id);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Error generating certificate:", error);
    safeErrorResponse(res, error);
  }
});

router.get("/request/:request_id", certificateLimiter, requireAuth, async (req, res) => {
  try {
    const { request_id } = req.params;
    const user_id = req.user.id;

    const { data: request } = await supabase
      .from("requests")
      .select("student_id")
      .eq("id", request_id)
      .single();

    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Request not found",
      });
    }

    const userRole = req.userRole;

    const isOwner = request.student_id === user_id;
    const isAdmin =
      isStaffRole(userRole) || isManagementRole(userRole);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to view this certificate",
      });
    }

    const { data: certificate, error } = await supabase
      .from("clearance_certificates")
      .select("*")
      .eq("request_id", request_id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      return res.status(500).json({
        success: false,
        error: "Error fetching certificate",
      });
    }

    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: "Certificate not found",
      });
    }

    res.json({
      success: true,
      certificate: certificate,
    });
  } catch (error) {
    console.error("Error fetching certificate:", error);
    safeErrorResponse(res, error);
  }
});

router.get("/verify/:code", verifyLimiter, async (req, res) => {
  try {
    const { code } = req.params;

    const result = await verifyCertificate(code);

    res.json(result);
  } catch (error) {
    console.error("Error verifying certificate:", error);
    safeErrorResponse(res, error);
  }
});

module.exports = router;
