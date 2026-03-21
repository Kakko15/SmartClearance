const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");
const { ROLES } = require("../constants/roles");
const { logAction, ACTIONS } = require("../services/auditService");

router.get("/pending-accounts", requireAuth, requireRole("super_admin"), async (req, res) => {
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

router.get("/all-users", requireAuth, async (req, res) => {
  try {
    const { data: admin } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .single();
    if (!admin || admin.role !== "super_admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, users: data });
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
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
      targetId: userId,
      targetType: "profile",
      metadata: { admin_role: admin.role },
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
      targetId: userId,
      targetType: "profile",
      metadata: { admin_role: admin.role, reason },
    });
  } catch (error) {
    console.error("Error rejecting account:", error);
    safeErrorResponse(res, error);
  }
});

router.post("/bulk-approve", requireAuth, async (req, res) => {
  try {
    const { userIds } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No accounts selected" });
    }

    const { data: admin } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", adminId)
      .single();
    if (!admin || admin.role !== "super_admin") {
      return res
        .status(403)
        .json({
          success: false,
          error: "Only super admin can approve accounts",
        });
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

        try {
          await supabase.from("auth_audit_log").insert({
            user_id: userId,
            action: "account_approved_by_admin",
            success: true,
            metadata: {
              approved_by: adminId,
              admin_role: admin.role,
              bulk: true,
            },
          });
        } catch (logErr) {
          console.warn("Auth audit log insert failed:", logErr.message);
        }
      }
    }

    logAction(adminId, ACTIONS.ACCOUNT_BULK_APPROVED, {
      targetType: "profile",
      metadata: {
        count: results.approved.length,
        approved: results.approved,
        failed: results.failed,
      },
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

router.post("/bulk-reject", requireAuth, async (req, res) => {
  try {
    const { userIds, reason } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No accounts selected" });
    }
    if (!reason || !reason.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Rejection reason is required" });
    }

    const { data: admin } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", adminId)
      .single();
    if (!admin || admin.role !== "super_admin") {
      return res
        .status(403)
        .json({
          success: false,
          error: "Only super admin can reject accounts",
        });
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

        try {
          await supabase.from("auth_audit_log").insert({
            user_id: userId,
            action: "account_rejected_by_admin",
            success: true,
            metadata: {
              rejected_by: adminId,
              admin_role: admin.role,
              reason,
              bulk: true,
            },
          });
        } catch (logErr) {
          console.warn("Auth audit log insert failed:", logErr.message);
        }
      }
    }

    logAction(adminId, ACTIONS.ACCOUNT_BULK_REJECTED, {
      targetType: "profile",
      metadata: {
        count: results.rejected.length,
        reason,
        rejected: results.rejected,
        failed: results.failed,
      },
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

router.get("/account-stats", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { count: pendingCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending_review");

    const { count: approvedCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "approved");

    const { count: autoApprovedCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "auto_approved");

    const { count: rejectedCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "rejected");

    const pending = pendingCount || 0;
    const approved = approvedCount || 0;
    const autoApproved = autoApprovedCount || 0;
    const rejected = rejectedCount || 0;

    res.json({
      success: true,
      stats: {
        pending,
        approved,
        autoApproved,
        rejected,
        total: pending + approved + autoApproved + rejected,
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
