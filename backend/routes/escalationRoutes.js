const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const { requireAuth } = require("../middleware/authMiddleware");
const { isStaffRole, isManagementRole } = require("../constants/roles");
const {
  checkAndEscalateRequests,
  getEscalationStats,
  manuallyEscalateRequest,
} = require("../services/escalationService");

router.post("/check", requireAuth, async (req, res) => {
  try {
    const admin_id = req.user.id;

    const { data: admin } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", admin_id)
      .single();

    if (!admin || !isManagementRole(admin.role)) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized - admin access required",
      });
    }

    const result = await checkAndEscalateRequests();

    res.json(result);
  } catch (error) {
    console.error("Error checking escalations:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const admin_id = req.user.id;

    const { data: admin } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", admin_id)
      .single();

    if (!admin || !isManagementRole(admin.role)) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized - admin access required",
      });
    }

    const result = await getEscalationStats();

    res.json(result);
  } catch (error) {
    console.error("Error getting escalation stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/manual", requireAuth, async (req, res) => {
  try {
    const { request_id, reason } = req.body;
    const admin_id = req.user.id;

    if (!request_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const { data: admin } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", admin_id)
      .single();

    if (!admin || !isManagementRole(admin.role)) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized - admin access required",
      });
    }

    const result = await manuallyEscalateRequest(request_id, admin_id, reason);

    res.json(result);
  } catch (error) {
    console.error("Error manually escalating:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
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

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user_id)
      .single();

    const isOwner = request.student_id === user_id;
    const isAdmin = isStaffRole(userProfile?.role) || isManagementRole(userProfile?.role);

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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
