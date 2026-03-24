const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const supabase = require("../supabaseClient");
const { requireAuth } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");
const { isStaffRole, isManagementRole } = require("../constants/roles");
const {
  checkAndEscalateRequests,
  getEscalationStats,
  manuallyEscalateRequest,
} = require("../services/escalationService");

const isDev = process.env.NODE_ENV !== "production";

const escalationWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

const escalationReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

router.use((req, _res, next) => {
  if (req.method === "GET") return escalationReadLimiter(req, _res, next);
  return escalationWriteLimiter(req, _res, next);
});

router.post("/check", requireAuth, async (req, res) => {
  try {
    if (!isManagementRole(req.userRole)) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized - admin access required",
      });
    }

    const result = await checkAndEscalateRequests();

    res.json(result);
  } catch (error) {
    console.error("Error checking escalations:", error);
    safeErrorResponse(res, error);
  }
});

router.get("/stats", requireAuth, async (req, res) => {
  try {
    if (!isManagementRole(req.userRole)) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized - admin access required",
      });
    }

    const result = await getEscalationStats();

    res.json(result);
  } catch (error) {
    console.error("Error getting escalation stats:", error);
    safeErrorResponse(res, error);
  }
});

router.post("/manual", requireAuth, async (req, res) => {
  try {
    const { request_id, reason } = req.body;

    if (!request_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (!isManagementRole(req.userRole)) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized - admin access required",
      });
    }

    const result = await manuallyEscalateRequest(request_id, req.user.id, reason);

    res.json(result);
  } catch (error) {
    console.error("Error manually escalating:", error);
    safeErrorResponse(res, error);
  }
});

router.get("/history/:request_id", requireAuth, async (req, res) => {
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
        error: "Unauthorized to view escalation history",
      });
    }

    const { data: history, error } = await supabase
      .from("escalation_history")
      .select("*")
      .eq("request_id", request_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      history: history || [],
    });
  } catch (error) {
    console.error("Error fetching escalation history:", error);
    safeErrorResponse(res, error);
  }
});

module.exports = router;
