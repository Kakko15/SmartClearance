const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const { requireAuth } = require("../middleware/authMiddleware");
const { ROLES } = require("../constants/roles");
const { logAction, ACTIONS } = require("../services/auditService");

router.get("/pending-accounts", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("verification_status", "pending_review")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      accounts: data,
      count: data.length,
    });
  } catch (error) {
    console.error("Error fetching pending accounts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch pending accounts",
    });
  }
});

router.post("/approve-account", requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    const adminId = req.user.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const { data: admin, error: adminError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", adminId)
      .single();

    if (adminError || !admin) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!["super_admin"].includes(admin.role)) {
      return res.status(403).json({
        success: false,
        error: "Only super admin can approve accounts",
      });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        verification_status: "approved",
        account_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    try {
      await supabase.from("auth_audit_log").insert({
        user_id: userId,
        action: "account_approved_by_admin",
        success: true,
        metadata: {
          approved_by: adminId,
          admin_role: admin.role,
        },
      });
    } catch (logError) {
      console.warn("Auth audit log insert failed:", logError.message);
    }

    res.json({
      success: true,
      message: "Account approved successfully",
      account: data,
    });

    logAction(adminId, ACTIONS.ACCOUNT_APPROVED, {
      targetId: userId, targetType: "profile", metadata: { admin_role: admin.role },
    });
  } catch (error) {
    console.error("Error approving account:", error);
    res.status(500).json({
      success: false,
      error: "Failed to approve account",
    });
  }
});

router.post("/reject-account", requireAuth, async (req, res) => {
  try {
    const { userId, reason } = req.body;
    const adminId = req.user.id;

    if (!userId || !reason) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const { data: admin, error: adminError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", adminId)
      .single();

    if (adminError || !admin) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!["super_admin"].includes(admin.role)) {
      return res.status(403).json({
        success: false,
        error: "Only super admin can reject accounts",
      });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        verification_status: "rejected",
        account_enabled: false,
        rejection_reason: reason,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Supabase reject error details:", error);
      throw error;
    }

    try {
      await supabase.from("auth_audit_log").insert({
        user_id: userId,
        action: "account_rejected_by_admin",
        success: true,
        metadata: {
          rejected_by: adminId,
          admin_role: admin.role,
          reason: reason,
        },
      });
    } catch (logError) {
      console.warn("Auth audit log insert failed:", logError.message);
    }

    res.json({
      success: true,
      message: "Account rejected",
      account: data,
    });

    logAction(adminId, ACTIONS.ACCOUNT_REJECTED, {
      targetId: userId, targetType: "profile", metadata: { admin_role: admin.role, reason },
    });
  } catch (error) {
    console.error("Error rejecting account:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to reject account",
    });
  }
});

// ── Bulk Approve ──────────────────────────────────────────────────────────────
router.post("/bulk-approve", requireAuth, async (req, res) => {
  try {
    const { userIds } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: "No accounts selected" });
    }

    const { data: admin } = await supabase
      .from("profiles").select("role").eq("id", adminId).single();
    if (!admin || admin.role !== "super_admin") {
      return res.status(403).json({ success: false, error: "Only super admin can approve accounts" });
    }

    const results = { approved: [], failed: [] };

    for (const userId of userIds) {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          verification_status: "approved",
          account_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .eq("verification_status", "pending_review")
        .select()
        .single();

      if (error || !data) {
        results.failed.push(userId);
      } else {
        results.approved.push(userId);
      }
    }

    logAction(adminId, ACTIONS.ACCOUNT_BULK_APPROVED, {
      targetType: "profile",
      metadata: { count: results.approved.length, approved: results.approved, failed: results.failed },
    });

    res.json({
      success: true,
      message: `${results.approved.length} approved, ${results.failed.length} failed`,
      results,
    });
  } catch (error) {
    console.error("Bulk approve error:", error);
    res.status(500).json({ success: false, error: "Bulk approve failed" });
  }
});

// ── Bulk Reject ───────────────────────────────────────────────────────────────
router.post("/bulk-reject", requireAuth, async (req, res) => {
  try {
    const { userIds, reason } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: "No accounts selected" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Rejection reason is required" });
    }

    const { data: admin } = await supabase
      .from("profiles").select("role").eq("id", adminId).single();
    if (!admin || admin.role !== "super_admin") {
      return res.status(403).json({ success: false, error: "Only super admin can reject accounts" });
    }

    const results = { rejected: [], failed: [] };

    for (const userId of userIds) {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          verification_status: "rejected",
          account_enabled: false,
          rejection_reason: reason,
        })
        .eq("id", userId)
        .eq("verification_status", "pending_review")
        .select()
        .single();

      if (error || !data) {
        results.failed.push(userId);
      } else {
        results.rejected.push(userId);
      }
    }

    logAction(adminId, ACTIONS.ACCOUNT_BULK_REJECTED, {
      targetType: "profile",
      metadata: { count: results.rejected.length, reason, rejected: results.rejected, failed: results.failed },
    });

    res.json({
      success: true,
      message: `${results.rejected.length} rejected, ${results.failed.length} failed`,
      results,
    });
  } catch (error) {
    console.error("Bulk reject error:", error);
    res.status(500).json({ success: false, error: "Bulk reject failed" });
  }
});

router.get("/account-stats", requireAuth, async (req, res) => {
  try {
    const { data: pending } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending_review");

    const { data: approved } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "approved");

    const { data: autoApproved } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "auto_approved");

    const { data: rejected } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "rejected");

    res.json({
      success: true,
      stats: {
        pending: pending?.length || 0,
        approved: approved?.length || 0,
        autoApproved: autoApproved?.length || 0,
        rejected: rejected?.length || 0,
        total:
          (pending?.length || 0) +
          (approved?.length || 0) +
          (autoApproved?.length || 0) +
          (rejected?.length || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
    });
  }
});

module.exports = router;
