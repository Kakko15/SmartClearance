const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const supabase = require("../supabaseClient");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");
const { ROLES } = require("../constants/roles");
const { logAction, ACTIONS } = require("../services/auditService");

const isDev = process.env.NODE_ENV !== "production";

const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

const adminReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

router.use((req, _res, next) => {
  if (req.method === "GET") return adminReadLimiter(req, _res, next);
  return adminWriteLimiter(req, _res, next);
});

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
    safeErrorResponse(res, error);
  }
});

router.get("/all-users", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const selectedFields =
      "id, full_name, email, role, student_number, course_year, verification_status, account_enabled, created_at";

    if (page > 0 && limit > 0) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const [{ data, error }, { count, error: countError }] = await Promise.all([
        supabase
          .from("profiles")
          .select(selectedFields)
          .order("created_at", { ascending: false })
          .range(from, to),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true }),
      ]);

      if (error) throw error;
      if (countError) throw countError;

      return res.json({
        success: true,
        users: data,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(selectedFields)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, users: data });
  } catch (error) {
    console.error("Error fetching all users:", error);
    safeErrorResponse(res, error);
  }
});

router.post("/approve-account", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { userId } = req.body;
    const adminId = req.user.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
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
          admin_role: req.userRole,
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
      metadata: { admin_role: req.userRole },
    });
  } catch (error) {
    console.error("Error approving account:", error);
    safeErrorResponse(res, error);
  }
});

router.post("/reject-account", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { userId, reason } = req.body;
    const adminId = req.user.id;

    if (!userId || !reason) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (reason.length > 2000) {
      return res.status(400).json({
        success: false,
        error: "Reason must be 2000 characters or fewer",
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
          admin_role: req.userRole,
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
      metadata: { admin_role: req.userRole, reason },
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
    if (userIds.length > 200) {
      return res
        .status(400)
        .json({ success: false, error: "Cannot approve more than 200 accounts at once" });
    }

    if (req.userRole !== "super_admin") {
      return res
        .status(403)
        .json({
          success: false,
          error: "Only super admin can approve accounts",
        });
    }

    const results = { approved: [], failed: [] };
    const now = new Date().toISOString();

    const settledResults = await Promise.allSettled(
      userIds.map(async (userId) => {
        const { data, error } = await supabase
          .from("profiles")
          .update({
            verification_status: "approved",
            account_enabled: true,
            updated_at: now,
          })
          .eq("id", userId)
          .eq("verification_status", "pending_review")
          .select()
          .single();

        if (error || !data) {
          throw new Error(`Failed for ${userId}`);
        }

        await supabase.from("auth_audit_log").insert({
          user_id: userId,
          action: "account_approved_by_admin",
          success: true,
          metadata: {
            approved_by: adminId,
            admin_role: req.userRole,
            bulk: true,
          },
        }).catch((logErr) => {
          console.warn("Auth audit log insert failed:", logErr.message);
        });

        return userId;
      }),
    );

    for (const result of settledResults) {
      if (result.status === "fulfilled") {
        results.approved.push(result.value);
      } else {
        results.failed.push(result.reason?.message || "unknown");
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
    safeErrorResponse(res, error);
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
    if (userIds.length > 200) {
      return res
        .status(400)
        .json({ success: false, error: "Cannot reject more than 200 accounts at once" });
    }
    if (!reason || !reason.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Rejection reason is required" });
    }

    if (req.userRole !== "super_admin") {
      return res
        .status(403)
        .json({
          success: false,
          error: "Only super admin can reject accounts",
        });
    }

    const results = { rejected: [], failed: [] };

    const settled = await Promise.allSettled(
      userIds.map(async (userId) => {
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
          throw new Error(error?.message || "Update failed");
        }

        try {
          await supabase.from("auth_audit_log").insert({
            user_id: userId,
            action: "account_rejected_by_admin",
            success: true,
            metadata: {
              rejected_by: adminId,
              admin_role: req.userRole,
              reason,
              bulk: true,
            },
          });
        } catch (logErr) {
          console.warn("Auth audit log insert failed:", logErr.message);
        }

        return userId;
      }),
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.rejected.push(result.value);
      } else {
        results.failed.push("unknown");
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
    safeErrorResponse(res, error);
  }
});

router.get("/account-stats", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const [
      { count: pendingCount },
      { count: approvedCount },
      { count: autoApprovedCount },
      { count: rejectedCount },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "pending_review"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "approved"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "auto_approved"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "rejected"),
    ]);

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
    safeErrorResponse(res, error);
  }
});

module.exports = router;
