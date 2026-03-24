const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const supabase = require("../supabaseClient");
const {
  notifyRequestSubmitted,
  notifyRequestApproved,
  notifyRequestRejected,
  notifyNextStageStaff,
  notifyRequestResubmitted,
} = require("../services/notificationService");
const { generateCertificate } = require("../services/certificateService");
const { classifyAndRouteRequest } = require("../services/aiRequestRouter");
const { requireAuth } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");
const {
  ROLES,
  isClearanceRole,
  isManagementRole,
} = require("../constants/roles");

const isDev = process.env.NODE_ENV !== "production";

const requestWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

const requestReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

router.use((req, _res, next) => {
  if (req.method === "GET") return requestReadLimiter(req, _res, next);
  return requestWriteLimiter(req, _res, next);
});

const ROLE_DISPLAY = {
  [ROLES.LIBRARIAN]: "Librarian",
  [ROLES.CASHIER]: "Cashier",
  [ROLES.REGISTRAR]: "Registrar",
  [ROLES.SIGNATORY]: "Signatory",
  [ROLES.SUPER_ADMIN]: "Super Admin",
};

function formatRoleDisplay(role) {
  if (!role) return "Staff";
  return (
    ROLE_DISPLAY[role] ||
    role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

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
  try {
    const { error } = await supabase.from("request_history").insert({
      request_id: requestId,
      processed_by: processedBy,
      previous_status: previousStatus,
      new_status: newStatus,
      action_taken: actionTaken,
      comments: comments,
    });
    if (error) {
      console.warn("logHistory insert failed:", error.message);
    }
  } catch (err) {
    console.warn("logHistory error:", err.message);
  }
}

router.post("/create", requireAuth, async (req, res) => {
  try {
    const student_id = req.user.id;
    const {
      doc_type_id,
      request_details,
      clearance_intent,
      clearance_intent_others,
      thesis_title,
      semesters_enrolled,
      summers_enrolled,
      student_agreement_accepted,
    } = req.body;

    if (!doc_type_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: doc_type_id",
      });
    }

    if (request_details && request_details.length > 5000) {
      return res.status(400).json({
        success: false,
        error: "Request details must be 5000 characters or fewer",
      });
    }

    if (thesis_title && thesis_title.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Thesis title must be 500 characters or fewer",
      });
    }

    if (clearance_intent_others && clearance_intent_others.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Clearance intent details must be 500 characters or fewer",
      });
    }

    if (isDev) console.log("Initiating AI request classification...");

    const aiResult = await classifyAndRouteRequest({
      doc_type_id,
      student_id,
      request_details,
    });

    if (!aiResult.success) {
      console.warn("AI classification failed, using fallback routing");
    } else if (isDev) {
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

        clearance_intent: clearance_intent || [],
        clearance_intent_others: clearance_intent_others || null,
        thesis_title: thesis_title || null,
        semesters_enrolled: semesters_enrolled || null,
        summers_enrolled: summers_enrolled || null,
        student_agreement_accepted: student_agreement_accepted || false,

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
    safeErrorResponse(res, error);
  }
});

router.post("/:id/approve", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const admin_id = req.user.id;

    const userRole = req.userRole;
    if (!userRole || !isClearanceRole(userRole)) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const { data: request, error: reqError } = await supabase
      .from("requests")
      .select("*, document_types(*)")
      .eq("id", id)
      .single();

    if (reqError) throw reqError;

    if (request.is_completed) {
      return res.status(400).json({
        success: false,
        error: "This request has already been completed",
      });
    }

    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", request.student_id)
      .maybeSingle();

    if (!studentProfile) {
      return res.status(400).json({
        success: false,
        error: "Student profile no longer exists",
      });
    }

    if (!request.document_types || !request.document_types.required_stages) {
      return res.status(400).json({
        success: false,
        error: "Document type configuration is missing or has been deleted",
      });
    }

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

        last_activity_at: now,

        escalated: false,
        escalated_at: null,
        escalation_level: null,
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
    } else {
      const nextStage = request.document_types.required_stages[nextStageIndex];
      notifyNextStageStaff(id, nextStage).catch((err) =>
        console.warn("notifyNextStageStaff error:", err.message),
      );
    }

    res.json({
      success: true,
      request: updated,
      message: isLastStage ? "Request completed!" : "Moved to next stage",
    });
  } catch (error) {
    safeErrorResponse(res, error);
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

    if (reason.length > 2000) {
      return res
        .status(400)
        .json({ success: false, error: "Reason must be 2000 characters or fewer" });
    }

    const userRole = req.userRole;
    if (!userRole || !isClearanceRole(userRole)) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const { data: request, error: reqError } = await supabase
      .from("requests")
      .select("*, document_types(*)")
      .eq("id", id)
      .single();

    if (reqError) throw reqError;

    if (request.is_completed) {
      return res.status(400).json({
        success: false,
        error: "Cannot reject — this request has already been completed",
      });
    }

    if (request.current_status === "on_hold") {
      return res.status(400).json({
        success: false,
        error: "This request is already on hold",
      });
    }

    if (!request.document_types || !request.document_types.required_stages) {
      return res.status(400).json({
        success: false,
        error: "Document type configuration is missing or has been deleted",
      });
    }

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
    safeErrorResponse(res, error);
  }
});

router.post("/:id/resubmit", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const student_id = req.user.id;

    const { data: request, error: reqError } = await supabase
      .from("requests")
      .select("*, document_types(*)")
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

    if (!request.document_types || !request.document_types.required_stages) {
      return res.status(400).json({
        success: false,
        error: "Document type configuration is missing or has been deleted",
      });
    }

    const currentStage =
      request.document_types.required_stages[request.current_stage_index];
    notifyRequestResubmitted(id, student_id, currentStage).catch((err) =>
      console.warn("notifyRequestResubmitted error:", err.message),
    );

    res.json({
      success: true,
      request: updated,
      message: "Request resubmitted for review",
    });
  } catch (error) {
    safeErrorResponse(res, error);
  }
});

router.get("/student/:student_id", requireAuth, async (req, res) => {
  try {
    const { student_id } = req.params;

    const callerRole = req.userRole;
    if (
      req.user.id !== student_id &&
      !isClearanceRole(callerRole) &&
      !isManagementRole(callerRole)
    ) {
      return res
        .status(403)
        .json({ success: false, error: "You can only view your own requests" });
    }

    const { data, error } = await supabase
      .from("requests")
      .select("*, document_types(*)")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, requests: data });
  } catch (error) {
    safeErrorResponse(res, error);
  }
});

router.get("/admin/:role", requireAuth, async (req, res) => {
  try {
    const { role } = req.params;

    const callerRole = req.userRole;
    if (
      !callerRole ||
      (callerRole !== role && callerRole !== ROLES.SUPER_ADMIN)
    ) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized — role mismatch" });
    }

    const ROLE_TO_STAGE = {
      [ROLES.LIBRARIAN]: "library",
      [ROLES.CASHIER]: "cashier",
      [ROLES.REGISTRAR]: "registrar",

      library_admin: "library",
      cashier_admin: "cashier",
      registrar_admin: "registrar",
    };
    const stageName = ROLE_TO_STAGE[role] || role.replace("_admin", "");

    // Determine which doc_type + stage_index combinations match this stage
    const { data: docTypes, error: docError } = await supabase
      .from("document_types")
      .select("id, required_stages");

    if (docError) throw docError;

    const matchingConditions = [];
    for (const dt of docTypes || []) {
      (dt.required_stages || []).forEach((stage, idx) => {
        if (stage === stageName) {
          matchingConditions.push(
            `and(doc_type_id.eq.${dt.id},current_stage_index.eq.${idx})`,
          );
        }
      });
    }

    // If no doc types have this stage, return empty immediately
    if (matchingConditions.length === 0) {
      return res.json({ success: true, requests: [] });
    }

    const { data: requests, error: reqError } = await supabase
      .from("requests")
      .select(
        "*, document_types(*), profiles!requests_student_id_fkey(full_name, student_number)",
      )
      .in("current_status", ["pending", "approved"])
      .or(matchingConditions.join(","))
      .order("created_at", { ascending: true });

    if (reqError) throw reqError;

    res.json({ success: true, requests: requests || [] });
  } catch (error) {
    safeErrorResponse(res, error);
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
    safeErrorResponse(res, error);
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
      .maybeSingle();

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
    safeErrorResponse(res, error);
  }
});

module.exports = router;
