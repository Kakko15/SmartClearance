const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const {
  notifyRequestSubmitted,
  notifyRequestApproved,
  notifyRequestRejected,
} = require("../services/notificationService");
const { generateCertificate } = require("../services/certificateService");
const { classifyAndRouteRequest } = require("../services/aiRequestRouter");
const { requireAuth } = require("../middleware/authMiddleware");
const { ROLES, isClearanceRole, isManagementRole } = require("../constants/roles");

async function getUserRole(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data.role;
}

/** Map role key to display name for history logs */
const ROLE_DISPLAY = {
  [ROLES.LIBRARIAN]: "Librarian",
  [ROLES.CASHIER]: "Cashier",
  [ROLES.REGISTRAR]: "Registrar",
  [ROLES.SIGNATORY]: "Signatory",
  [ROLES.SUPER_ADMIN]: "Super Admin",
};

function formatRoleDisplay(role) {
  if (!role) return "Staff";
  return ROLE_DISPLAY[role] || role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Map a clearance stage name to the role that handles it */
const STAGE_TO_ROLE = {
  library: ROLES.LIBRARIAN,
  cashier: ROLES.CASHIER,
  registrar: ROLES.REGISTRAR,
};

async function logHistory(
  requestId,
  processedBy,
  previousStatus,
  newStatus,
  actionTaken,
  comments = null,
) {
  await supabase.from("request_history").insert({
    request_id: requestId,
    processed_by: processedBy,
    previous_status: previousStatus,
    new_status: newStatus,
    action_taken: actionTaken,
    comments: comments,
  });
}

router.post("/create", requireAuth, async (req, res) => {
  try {
    const student_id = req.user.id;
    const { doc_type_id, request_details } = req.body;

    console.log("Initiating AI request classification...");

    const aiResult = await classifyAndRouteRequest({
      doc_type_id,
      student_id,
      request_details,
    });

    if (!aiResult.success) {
      console.warn("AI classification failed, using fallback routing");
    } else {
      console.log("AI Classification Complete:", {
        category: aiResult.classification.category,
        urgency: aiResult.classification.urgency,
        priorityScore: aiResult.classification.priorityScore,
        assignedOffice: aiResult.routing.initialStage,
      });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("requests")
      .insert({
        student_id,
        doc_type_id,
        current_status: "pending",
        current_stage_index: 0,
        is_completed: false,
        // BUG 4 FIX: Set last_activity_at on creation
        last_activity_at: now,

        ai_classified: aiResult.success,
        classification_data: aiResult.success ? aiResult.classification : null,
        routing_data: aiResult.success ? aiResult.routing : null,
        priority_score: aiResult.success
          ? aiResult.classification.priorityScore
          : 50,
        urgency_level: aiResult.success
          ? aiResult.classification.urgency
          : "medium",
        estimated_completion_hours: aiResult.success
          ? aiResult.routing.estimatedProcessingTime
          : null,
        auto_assigned: aiResult.success,
      })
      .select()
      .single();

    if (error) throw error;

    // BUG 3 FIX: Call with correct 2-param signature (was passing unused 3rd arg)
    await notifyRequestSubmitted(data.id, student_id);

    res.json({
      success: true,
      request: data,
      aiInsights: aiResult.success
        ? {
            category: aiResult.classification.category,
            urgency: aiResult.classification.urgency,
            estimatedTime: aiResult.routing.estimatedProcessingTime,
            assignedOffice: aiResult.routing.initialStage,
          }
        : null,
    });
  } catch (error) {
    console.error("Request creation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/:id/approve", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const admin_id = req.user.id;

    const userRole = await getUserRole(admin_id);
    if (!userRole || !isClearanceRole(userRole)) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const { data: request, error: reqError } = await supabase
      .from("requests")
      .select("*, document_types(*)")
      .eq("id", id)
      .single();

    if (reqError) throw reqError;

    const currentStage =
      request.document_types.required_stages[request.current_stage_index];

    const requiredRole = STAGE_TO_ROLE[currentStage];
    if (userRole !== requiredRole && userRole !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        error: `Only ${formatRoleDisplay(requiredRole)} can approve this stage`,
      });
    }

    const nextStageIndex = request.current_stage_index + 1;
    const isLastStage =
      nextStageIndex >= request.document_types.required_stages.length;

    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("requests")
      .update({
        current_stage_index: isLastStage
          ? request.current_stage_index
          : nextStageIndex,
        current_status: isLastStage ? "completed" : "approved",
        is_completed: isLastStage,
        updated_at: now,
        // BUG 4 FIX: Update last_activity_at on every status change
        last_activity_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logHistory(
      id,
      admin_id,
      request.current_status,
      isLastStage ? "completed" : "approved",
      "approved",
      `Approved by ${formatRoleDisplay(userRole)} at ${currentStage} stage`,
    );

    await notifyRequestApproved(
      id,
      request.student_id,
      currentStage,
      isLastStage,
    );

    if (isLastStage) {
      await generateCertificate(id);
    }

    res.json({
      success: true,
      request: updated,
      message: isLastStage ? "Request completed!" : "Moved to next stage",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/:id/reject", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const admin_id = req.user.id;
    const { reason } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, error: "Rejection reason required" });
    }

    const userRole = await getUserRole(admin_id);
    if (!userRole || !isClearanceRole(userRole)) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const { data: request, error: reqError } = await supabase
      .from("requests")
      .select("*, document_types(*)")
      .eq("id", id)
      .single();

    if (reqError) throw reqError;

    const currentStage =
      request.document_types.required_stages[request.current_stage_index];
    const requiredRole = STAGE_TO_ROLE[currentStage];
    if (userRole !== requiredRole && userRole !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        error: `Only ${formatRoleDisplay(requiredRole)} can reject this stage`,
      });
    }

    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("requests")
      .update({
        current_status: "on_hold",
        updated_at: now,
        // BUG 4 FIX: Update last_activity_at on reject
        last_activity_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logHistory(
      id,
      admin_id,
      request.current_status,
      "on_hold",
      "rejected",
      reason,
    );

    await notifyRequestRejected(id, request.student_id, currentStage, reason);

    res.json({
      success: true,
      request: updated,
      message: "Request rejected and put on hold",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/:id/resubmit", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const student_id = req.user.id;

    const { data: request, error: reqError } = await supabase
      .from("requests")
      .select("*")
      .eq("id", id)
      .eq("student_id", student_id)
      .single();

    if (reqError) throw reqError;

    if (request.current_status !== "on_hold") {
      return res.status(400).json({
        success: false,
        error: "Can only resubmit requests that are on hold",
      });
    }

    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("requests")
      .update({
        current_status: "pending",
        updated_at: now,
        // BUG 4 FIX: Update last_activity_at on resubmit
        last_activity_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    await logHistory(
      id,
      student_id,
      "on_hold",
      "pending",
      "resubmitted",
      "Student resubmitted request",
    );

    res.json({
      success: true,
      request: updated,
      message: "Request resubmitted for review",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/student/:student_id", requireAuth, async (req, res) => {
  try {
    const { student_id } = req.params;

    const { data, error } = await supabase
      .from("requests")
      .select("*, document_types(*)")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, requests: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/admin/:role", requireAuth, async (req, res) => {
  try {
    const { role } = req.params;

    // Support both old format (library_admin) and new format (librarian)
    const ROLE_TO_STAGE = {
      [ROLES.LIBRARIAN]: "library",
      [ROLES.CASHIER]: "cashier",
      [ROLES.REGISTRAR]: "registrar",
      // Legacy support
      library_admin: "library",
      cashier_admin: "cashier",
      registrar_admin: "registrar",
    };
    const stageName = ROLE_TO_STAGE[role] || role.replace("_admin", "");

    const { data: docTypes, error: docError } = await supabase
      .from("document_types")
      .select("id, required_stages");

    if (docError) throw docError;

    const { data: requests, error: reqError } = await supabase
      .from("requests")
      .select(
        "*, document_types(*), profiles!requests_student_id_fkey(full_name, student_number)",
      )
      .in("current_status", ["pending", "approved"])
      .order("created_at", { ascending: true });

    if (reqError) throw reqError;

    const filteredRequests = requests.filter((req) => {
      const currentStage =
        req.document_types.required_stages[req.current_stage_index];
      return currentStage === stageName;
    });

    res.json({ success: true, requests: filteredRequests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:id/history", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("request_history")
      .select("*, profiles!request_history_processed_by_fkey(full_name, role)")
      .eq("request_id", id)
      .order("timestamp", { ascending: false });

    if (error) throw error;

    res.json({ success: true, history: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/:id/delete", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const student_id = req.user.id;

    const { data: request, error: reqError } = await supabase
      .from("requests")
      .select("*")
      .eq("id", id)
      .eq("student_id", student_id)
      .single();

    if (reqError) throw reqError;

    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Request not found or you do not have permission to delete it",
      });
    }

    if (
      request.current_status !== "pending" &&
      request.current_status !== "on_hold"
    ) {
      return res.status(400).json({
        success: false,
        error: "Can only delete requests that are pending or on hold",
      });
    }

    const { error: deleteError } = await supabase
      .from("requests")
      .delete()
      .eq("id", id)
      .eq("student_id", student_id);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: "Request deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
