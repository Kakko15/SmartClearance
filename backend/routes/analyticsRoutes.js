const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

// GET /api/analytics/dashboard — super admin analytics
router.get("/dashboard", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const [
      pendingRes,
      completedRes,
      rejectedRes,
      totalRes,
      studentsRes,
      staffRes,
      requestsWithTime,
      stageData,
    ] = await Promise.all([
      // Count by status
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("current_status", "pending"),
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("is_completed", true),
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("current_status", "on_hold"),
      supabase.from("requests").select("id", { count: "exact", head: true }),
      // User counts
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).in("role", ["librarian", "cashier", "registrar", "signatory"]),
      // Completed requests with timestamps for avg completion time
      supabase.from("requests").select("created_at, updated_at").eq("is_completed", true).limit(500),
      // Current stage distribution for bottleneck analysis
      supabase.from("requests")
        .select("current_stage_index, document_types(required_stages)")
        .in("current_status", ["pending", "approved"])
        .limit(500),
    ]);

    // Calculate average completion time (in hours)
    let avgCompletionHours = 0;
    const completedRequests = requestsWithTime.data || [];
    if (completedRequests.length > 0) {
      const totalHours = completedRequests.reduce((sum, r) => {
        const created = new Date(r.created_at);
        const updated = new Date(r.updated_at);
        return sum + (updated - created) / (1000 * 60 * 60);
      }, 0);
      avgCompletionHours = Math.round((totalHours / completedRequests.length) * 10) / 10;
    }

    // Bottleneck analysis — count requests stuck at each stage
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
          rejected: rejectedRes.count ?? 0,
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
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
