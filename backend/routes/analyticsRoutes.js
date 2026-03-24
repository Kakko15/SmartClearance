const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const supabase = require("../supabaseClient");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");

const isDev = process.env.NODE_ENV !== "production";
const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

router.get(
  "/dashboard",
  analyticsLimiter,
  requireAuth,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const [
        pendingRes,
        completedRes,
        onHoldRes,
        totalRes,
        studentsRes,
        staffRes,
        requestsWithTime,
        stageData,
      ] = await Promise.all([
        supabase
          .from("requests")
          .select("id", { count: "exact", head: true })
          .eq("current_status", "pending"),
        supabase
          .from("requests")
          .select("id", { count: "exact", head: true })
          .eq("is_completed", true),
        supabase
          .from("requests")
          .select("id", { count: "exact", head: true })
          .eq("current_status", "on_hold"),
        supabase.from("requests").select("id", { count: "exact", head: true }),

        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "student"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("role", ["librarian", "cashier", "registrar", "signatory"]),

        supabase
          .from("requests")
          .select("created_at, updated_at")
          .eq("is_completed", true)
          .limit(500),

        supabase
          .from("requests")
          .select("current_stage_index, document_types(required_stages)")
          .in("current_status", ["pending", "approved"])
          .limit(500),
      ]);

      let avgCompletionHours = 0;
      const completedRequests = requestsWithTime.data || [];
      if (completedRequests.length > 0) {
        const totalHours = completedRequests.reduce((sum, r) => {
          const created = new Date(r.created_at);
          const updated = new Date(r.updated_at);
          return sum + (updated - created) / (1000 * 60 * 60);
        }, 0);
        avgCompletionHours =
          Math.round((totalHours / completedRequests.length) * 10) / 10;
      }

      const stageCounts = {};
      (stageData.data || []).forEach((r) => {
        const stages = r.document_types?.required_stages;
        if (stages && r.current_stage_index < stages.length) {
          const stage = stages[r.current_stage_index];
          stageCounts[stage] = (stageCounts[stage] || 0) + 1;
        }
      });

      const bottlenecks = Object.entries(stageCounts)
        .map(([stage, count]) => ({ stage, count }))
        .sort((a, b) => b.count - a.count);

      res.json({
        success: true,
        analytics: {
          requests: {
            total: totalRes.count ?? 0,
            pending: pendingRes.count ?? 0,
            completed: completedRes.count ?? 0,
            onHold: onHoldRes.count ?? 0,
          },
          users: {
            students: studentsRes.count ?? 0,
            staff: staffRes.count ?? 0,
          },
          avgCompletionHours,
          bottlenecks,
        },
      });
    } catch (error) {
      console.error("Analytics error:", error);
      safeErrorResponse(res, error);
    }
  },
);

module.exports = router;
