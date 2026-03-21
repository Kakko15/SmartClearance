const supabase = require("../supabaseClient");
const { notifyRequestEscalated } = require("./notificationService");

if (!process.env.SUPER_ADMIN_EMAIL) {
  console.warn(
    "[Escalation] SUPER_ADMIN_EMAIL is not set — escalation emails to admin will be skipped.",
  );
}

async function snapshotApprovals(requestId) {
  const { data } = await supabase
    .from("professor_approvals")
    .select("id, status, comments, approved_at")
    .eq("request_id", requestId);
  return data || [];
}

async function restoreApprovals(requestId, snapshot) {
  const { data: current } = await supabase
    .from("professor_approvals")
    .select("id, status")
    .eq("request_id", requestId);
  if (!current) return;
  for (const prev of snapshot) {
    const now = current.find((c) => c.id === prev.id);
    if (now && prev.status !== "pending" && now.status === "pending") {
      await supabase
        .from("professor_approvals")
        .update({
          status: prev.status,
          comments: prev.comments,
          approved_at: prev.approved_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prev.id);
    }
  }
}

async function checkAndEscalateRequests() {
  try {
    const escalationDays = parseInt(process.env.ESCALATION_DAYS || "3");
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - escalationDays);

    console.log(
      `Checking for requests pending since ${cutoffDate.toISOString()}`,
    );

    const { data: requests, error } = await supabase
      .from("requests")
      .select("*, document_types(*), profiles!requests_student_id_fkey(*)")
      .in("current_status", ["pending", "approved"])
      .eq("is_completed", false)
      .lt("last_activity_at", cutoffDate.toISOString())
      .order("last_activity_at", { ascending: true });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      console.log("No requests need escalation");
      return { success: true, escalated: 0 };
    }

    console.log(`Found ${requests.length} requests needing escalation`);

    let escalatedCount = 0;

    for (const request of requests) {
      try {
        const daysPending = Math.floor(
          (new Date() - new Date(request.last_activity_at)) /
            (1000 * 60 * 60 * 24),
        );

        let escalationLevel = request.escalation_level || 0;
        escalationLevel += 1;

        const preSnapshot = await snapshotApprovals(request.id);

        const { error: updateError } = await supabase
          .from("requests")
          .update({
            escalated: true,
            escalated_at: new Date().toISOString(),
            escalation_level: escalationLevel,
          })
          .eq("id", request.id);

        if (updateError) throw updateError;

        await restoreApprovals(request.id, preSnapshot);

        const { error: historyError } = await supabase
          .from("escalation_history")
          .insert({
            request_id: request.id,
            escalation_level: escalationLevel,
            escalated_by: "system",
            reason: `Request pending for ${daysPending} days without action`,
          });

        if (historyError) throw historyError;

        await notifyRequestEscalated(request.id, escalationLevel, daysPending);

        escalatedCount++;
        console.log(
          `Escalated request ${request.id} to level ${escalationLevel}`,
        );
      } catch (error) {
        console.error(`Error escalating request ${request.id}:`, error);
      }
    }

    return {
      success: true,
      escalated: escalatedCount,
      total: requests.length,
    };
  } catch (error) {
    console.error("Escalation check error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getEscalationStats() {
  try {
    const { count: totalEscalated } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("escalated", true);

    const { data: byLevel } = await supabase
      .from("requests")
      .select("escalation_level")
      .eq("escalated", true);

    const levelCounts = {};
    byLevel?.forEach((req) => {
      const level = req.escalation_level || 0;
      levelCounts[level] = (levelCounts[level] || 0) + 1;
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentEscalations } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("escalated", true)
      .gte("escalated_at", sevenDaysAgo.toISOString());

    return {
      success: true,
      stats: {
        totalEscalated,
        byLevel: levelCounts,
        recentEscalations,
      },
    };
  } catch (error) {
    console.error("Error getting escalation stats:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function manuallyEscalateRequest(requestId, adminId, reason) {
  try {
    const { data: request, error: reqError } = await supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqError) throw reqError;

    const daysPending = Math.floor(
      (new Date() - new Date(request.last_activity_at)) / (1000 * 60 * 60 * 24),
    );

    let escalationLevel = request.escalation_level || 0;
    escalationLevel += 1;

    const preSnapshot = await snapshotApprovals(requestId);

    const { error: updateError } = await supabase
      .from("requests")
      .update({
        escalated: true,
        escalated_at: new Date().toISOString(),
        escalation_level: escalationLevel,
      })
      .eq("id", requestId);

    if (updateError) throw updateError;

    await restoreApprovals(requestId, preSnapshot);

    const { error: historyError } = await supabase
      .from("escalation_history")
      .insert({
        request_id: requestId,
        escalation_level: escalationLevel,
        escalated_by: adminId,
        reason: reason || `Manually escalated by admin`,
      });

    if (historyError) throw historyError;

    await notifyRequestEscalated(requestId, escalationLevel, daysPending);

    return {
      success: true,
      message: "Request escalated successfully",
    };
  } catch (error) {
    console.error("Error manually escalating request:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  checkAndEscalateRequests,
  getEscalationStats,
  manuallyEscalateRequest,
};
