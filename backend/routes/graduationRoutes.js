const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const supabase = require("../supabaseClient");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const { logAction, ACTIONS } = require("../services/auditService");
const { resolveUserEmail, sendEmail } = require("../services/notificationService");
const { escapeHtml } = require("../utils/escapeHtml");

// ── S5 FIX: Rate limiting on graduation endpoints ────────────────────────────
const isDev = process.env.NODE_ENV === "development";

const graduationWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 200 : 30,    // 30 state-changing requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

const graduationReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 120,   // 120 reads per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

// Apply read limiter to all GET routes, write limiter to all POST/DELETE routes
router.use((req, _res, next) => {
  if (req.method === "GET") return graduationReadLimiter(req, _res, next);
  return graduationWriteLimiter(req, _res, next);
});

// ── S8 FIX: Max comment length ───────────────────────────────────────────────
const MAX_COMMENT_LENGTH = 2000;

// ── G4: Default deadline (30 days from now) ──────────────────────────────────
const DEFAULT_DEADLINE_DAYS = 30;

// ── G7: Log status transitions to clearance_status_history ───────────────────
async function logStatusChange(requestId, stage, oldStatus, newStatus, changedBy, comments) {
  try {
    await supabase.from("clearance_status_history").insert({
      request_id: requestId,
      stage,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: changedBy,
      comments: comments || null,
    });
  } catch (err) {
    console.warn("Status history log failed:", err.message);
  }
}

// ── G6: Notify assigned signatories and admin staff when a student applies ───
async function notifyStaffOfNewApplication(requestId, studentName, portion) {
  try {
    // Get all staff who might need to act on this request
    const roles = ["librarian", "cashier", "registrar", "signatory"];
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", roles)
      .eq("account_enabled", true);

    if (!staff || staff.length === 0) return;

    const subject = `New Graduation Clearance Application — ${escapeHtml(studentName)}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #22c55e;">SmartClearance</h1>
        <h2>New Clearance Application</h2>
        <p><strong>${escapeHtml(studentName)}</strong> has submitted a <strong>${escapeHtml(portion)}</strong> graduation clearance application.</p>
        <p>Please check your SmartClearance dashboard to review when it reaches your stage.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">SmartClearance — Isabela State University</p>
      </div>
    `;

    // Send to each staff member (fire-and-forget, don't block)
    for (const member of staff) {
      const email = await resolveUserEmail(member.id);
      if (email) {
        sendEmail(member.id, requestId, email, subject, html).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Staff notification failed:", err.message);
  }
}

// ── B2 FIX: Collision-proof certificate number generator ─────────────────────
function generateCertificateNumber() {
  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `ISU-GC-${year}-${hex}`;
}

// ── B3 FIX: Single shared completion check ───────────────────────────────────
// Called after any stage approval to check if the entire clearance is done.
// Uses the `portion` column (B5 fix) to determine which stages are required.
async function tryCompleteRequest(requestId) {
  try {
    const { data: request } = await supabase
      .from("requests")
      .select("id, portion, library_status, cashier_status, registrar_status, is_completed")
      .eq("id", requestId)
      .single();

    if (!request || request.is_completed) return;

    // Check all professor approvals are done
    const { data: allApprovals } = await supabase
      .from("professor_approvals")
      .select("status")
      .eq("request_id", requestId);

    const allProfessorsApproved = allApprovals &&
      allApprovals.length > 0 &&
      allApprovals.every((a) => a.status === "approved");

    if (!allProfessorsApproved) return;

    // Check admin stages — B5 FIX: undergrad has no registrar step
    const isUndergrad = request.portion === "undergraduate";

    const adminDone = isUndergrad
      ? request.library_status === "approved" && request.cashier_status === "approved"
      : request.library_status === "approved" && request.cashier_status === "approved" && request.registrar_status === "approved";

    if (!adminDone) return;

    // All stages approved → mark complete
    const certificateNumber = generateCertificateNumber();
    await supabase
      .from("requests")
      .update({
        is_completed: true,
        professors_status: "approved",
        certificate_generated: true,
        certificate_generated_at: new Date().toISOString(),
        certificate_number: certificateNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("is_completed", false); // Optimistic lock — only update if still not completed
  } catch (err) {
    console.warn("tryCompleteRequest warning:", err.message);
  }
}

/**
 * Feature 7: Email notification for clearance status changes.
 * Fire-and-forget — never blocks the response.
 */
async function notifyClearanceStatusChange(requestId, status, stageName, comments) {
  try {
    const { data: request } = await supabase
      .from("requests")
      .select("student_id")
      .eq("id", requestId)
      .single();
    if (!request) return;

    const { data: student } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", request.student_id)
      .single();
    if (!student) return;

    const email = await resolveUserEmail(request.student_id);
    if (!email) return;

    const isCompleted = status === "completed";
    const isRejected = status === "rejected";

    const subject = isCompleted
      ? "🎉 Graduation Clearance Completed!"
      : isRejected
        ? `Clearance On Hold — ${stageName}`
        : `Clearance Approved — ${stageName}`;

    const statusColor = isCompleted ? "#22c55e" : isRejected ? "#ef4444" : "#3b82f6";
    const statusLabel = isCompleted ? "Completed" : isRejected ? "On Hold" : "Approved";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #22c55e; margin: 0;">SmartClearance</h1>
        </div>
        <h2 style="color: ${statusColor};">${escapeHtml(subject)}</h2>
        <p>Dear ${escapeHtml(student.full_name)},</p>
        <p>Your graduation clearance has been <strong style="color: ${statusColor};">${statusLabel}</strong> at the <strong>${escapeHtml(stageName)}</strong> stage.</p>
        ${comments ? `<p><strong>Comments:</strong> ${escapeHtml(comments)}</p>` : ""}
        ${isCompleted ? "<p>You can now download your graduation clearance certificate from the SmartClearance dashboard.</p>" : ""}
        ${isRejected ? "<p>Please check the comments and address any issues through your SmartClearance dashboard.</p>" : ""}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">SmartClearance — Isabela State University</p>
      </div>
    `;

    await sendEmail(request.student_id, requestId, email, subject, html);
  } catch (error) {
    console.warn("Clearance notification failed:", error.message);
  }
}

router.post("/apply", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const { student_id, portion } = req.body;

    // B1 FIX: Ownership check — only the authenticated student can apply for themselves
    if (req.user.id !== student_id) {
      return res.status(403).json({
        success: false,
        error: "You can only apply for your own clearance",
      });
    }

    if (!portion || !["undergraduate", "graduate"].includes(portion)) {
      return res.status(400).json({
        success: false,
        error: "Invalid portion. Must be 'undergraduate' or 'graduate'.",
      });
    }

    const { data: existing, error: checkError } = await supabase
      .from("requests")
      .select("id, is_completed")
      .eq("student_id", student_id)
      .eq("clearance_type", "graduation")
      .eq("is_completed", false)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "You already have a pending graduation clearance request",
      });
    }

    const { data: docType } = await supabase
      .from("document_types")
      .select("id")
      .eq("name", "Graduation Clearance")
      .single();

    if (!docType) {
      return res.status(500).json({
        success: false,
        error: "Graduation clearance type not found in system",
      });
    }

    // B5 FIX: Undergrad has no registrar step — auto-approve it on creation.
    // Graduate flow requires registrar, so it stays "pending".
    const isUndergrad = portion === "undergraduate";

    const { data: request, error } = await supabase
      .from("requests")
      .insert({
        student_id,
        doc_type_id: docType.id,
        clearance_type: "graduation",
        portion, // B5 FIX: Store portion so we don't have to infer it later
        deadline: new Date(Date.now() + DEFAULT_DEADLINE_DAYS * 24 * 60 * 60 * 1000).toISOString(), // G4
        current_status: "pending",
        professors_status: "pending",
        library_status: "pending",
        cashier_status: "pending",
        registrar_status: isUndergrad ? "approved" : "pending",
        is_completed: false,
      })
      .select()
      .single();

    // B1 FIX: If the unique index rejects the insert (race condition),
    // return a friendly error instead of crashing.
    if (error) {
      if (error.code === "23505") {
        return res.status(400).json({
          success: false,
          error: "You already have a pending graduation clearance request",
        });
      }
      throw error;
    }

    // Fetch all signatory accounts
    let { data: allSignatories } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "signatory")
      .eq("account_enabled", true);

    // Determine which signatories belong to this portion (REG Form 07)
    let wantedSignatories = allSignatories || [];
    if (portion === "undergraduate") {
      const undergradNames = [
        "Department Chairman",
        "College Dean",
        "Director Student Affairs",
        "NSTP Director",
        "Executive Officer",
      ];
      wantedSignatories = wantedSignatories.filter((p) => undergradNames.includes(p.full_name));
    } else if (portion === "graduate") {
      wantedSignatories = wantedSignatories.filter((p) => p.full_name === "Dean Graduate School");
    }

    const wantedIds = wantedSignatories.map((p) => p.id);

    // Step 1: Remove any auto-created professor_approvals that are NOT in our wanted list
    // (DB trigger may create approvals for ALL professors on request insert)
    if (wantedIds.length > 0) {
      await supabase
        .from("professor_approvals")
        .delete()
        .eq("request_id", request.id)
        .not("professor_id", "in", `(${wantedIds.join(",")})`);
    }

    // Step 2: Ensure wanted professor_approvals exist (upsert to handle both cases)
    if (wantedSignatories.length > 0) {
      // Link student to signatories
      const studentSignatoryLinks = wantedSignatories.map((p) => ({
        student_id,
        professor_id: p.id,
        course_code: "GRAD",
        course_name: p.full_name + " Clearance",
        is_active: true,
      }));

      await supabase
        .from("student_professors")
        .upsert(studentSignatoryLinks, {
          onConflict: "student_id,professor_id",
          ignoreDuplicates: true,
        });

      // Upsert professor approvals (trigger may have already created them)
      const approvalRecords = wantedSignatories.map((p) => ({
        request_id: request.id,
        professor_id: p.id,
        status: "pending",
      }));

      const { error: approvalError } = await supabase
        .from("professor_approvals")
        .upsert(approvalRecords, {
          onConflict: "request_id,professor_id",
          ignoreDuplicates: true,
        });

      if (approvalError) {
        console.warn("Professor approvals upsert warning:", approvalError.message);
      }

      // Update professor counts on the request
      await supabase
        .from("requests")
        .update({
          professors_total_count: wantedSignatories.length,
          professors_approved_count: 0,
        })
        .eq("id", request.id);
    }

    res.json({
      success: true,
      request,
      professorsAssigned: wantedSignatories?.length || 0,
      message: "Graduation clearance application submitted successfully",
    });

    // G6: Notify staff of new application (fire-and-forget)
    const { data: studentProfile } = await supabase.from("profiles").select("full_name").eq("id", student_id).single();
    notifyStaffOfNewApplication(request.id, studentProfile?.full_name || "Student", portion);

    // G7: Log initial status
    logStatusChange(request.id, "application", null, "pending", student_id, `${portion} graduation clearance submitted`);
  } catch (error) {
    console.error("Error applying for clearance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.delete("/cancel/:studentId", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const { studentId } = req.params;

    // S3 FIX: Ownership check — students can only cancel their own request
    if (req.user.id !== studentId) {
      return res.status(403).json({
        success: false,
        error: "You can only cancel your own clearance request",
      });
    }

    // Use maybeSingle to avoid throwing on 0 rows, and handle multiple rows gracefully
    const { data: requests, error: findError } = await supabase
      .from("requests")
      .select("id, current_status, is_completed")
      .eq("student_id", studentId)
      .eq("clearance_type", "graduation")
      .eq("is_completed", false);

    if (findError) throw findError;

    if (!requests || requests.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No pending graduation clearance request found",
      });
    }

    // Delete ALL pending graduation requests for this student (handles orphaned duplicates)
    for (const existingRequest of requests) {
      if (existingRequest.is_completed) continue;

      const { error: approvalDeleteError } = await supabase
        .from("professor_approvals")
        .delete()
        .eq("request_id", existingRequest.id);

      if (approvalDeleteError) {
        console.warn("Professor approvals cleanup warning:", approvalDeleteError.message);
      }

      const { error: deleteError } = await supabase
        .from("requests")
        .delete()
        .eq("id", existingRequest.id);

      if (deleteError) {
        console.error("Failed to delete request:", existingRequest.id, deleteError.message);
        throw deleteError;
      }
    }

    res.json({
      success: true,
      message: "Graduation clearance request cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling clearance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/status/:studentId", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const { studentId } = req.params;

    let request = null;

    const { data: viewData, error: viewError } = await supabase
      .from("clearance_status_view")
      .select("*")
      .eq("student_id", studentId)
      .single();

    if (viewError && viewError.code === "PGRST204") {
      const { data: reqData, error: reqError } = await supabase
        .from("requests")
        .select("*")
        .eq("student_id", studentId)
        .eq("clearance_type", "graduation")
        .eq("is_completed", false)
        .single();

      if (reqError && reqError.code !== "PGRST116") throw reqError;
      if (reqData) {
        request = { ...reqData, request_id: reqData.id };
      }
    } else if (viewError && viewError.code !== "PGRST116") {
      throw viewError;
    } else {
      request = viewData;
    }

    if (!request) {
      return res.json({
        success: true,
        hasRequest: false,
        message: "No clearance request found",
      });
    }

    const { data: professorApprovals } = await supabase
      .from("professor_approvals")
      .select(
        `
        id,
        professor_id,
        status,
        comments,
        approved_at,
        professor:professor_id (
          full_name,
          email
        )
      `,
      )
      .eq("request_id", request.request_id || request.id);

    const approvals = professorApprovals || [];
    const professorsApprovedCount = approvals.filter(
      (a) => a.status === "approved",
    ).length;
    const professorsTotalCount = approvals.length;

    // Always recalculate current_stage per REG Form 07 order
    {
      // B5 FIX: Use stored portion column, fall back to inference for legacy requests
      const UNDERGRAD_NAMES = ["Department Chairman", "College Dean", "Director Student Affairs", "NSTP Director", "Executive Officer"];
      const isUndergrad = request.portion === "undergraduate" ||
        (!request.portion && approvals.some((a) => UNDERGRAD_NAMES.includes(a.professor?.full_name)));
      const findProfStatus = (name) => approvals.find((a) => a.professor?.full_name === name)?.status;

      if (isUndergrad) {
        // REG Form 07 Undergraduate order (7 steps)
        if (findProfStatus("Department Chairman") !== "approved") {
          request.current_stage = "Department Chairman";
        } else if (findProfStatus("College Dean") !== "approved") {
          request.current_stage = "College Dean/Director";
        } else if (findProfStatus("Director Student Affairs") !== "approved") {
          request.current_stage = "Director for Student Affairs";
        } else if (request.library_status !== "approved") {
          request.current_stage = "Campus Librarian";
        } else if (request.cashier_status !== "approved") {
          request.current_stage = "Chief Accountant";
        } else if (findProfStatus("NSTP Director") !== "approved") {
          request.current_stage = "NSTP Director";
        } else if (findProfStatus("Executive Officer") !== "approved") {
          request.current_stage = "Executive Officer";
        } else {
          request.current_stage = "Completed";
        }
      } else {
        // REG Form 07 Graduate order
        if (request.cashier_status !== "approved") {
          request.current_stage = "Chief Accountant";
        } else if (request.library_status !== "approved") {
          request.current_stage = "Campus Librarian";
        } else if (request.registrar_status !== "approved") {
          request.current_stage = "Record Evaluator";
        } else if (findProfStatus("Dean Graduate School") !== "approved") {
          request.current_stage = "Dean, Graduate School";
        } else {
          request.current_stage = "Completed";
        }
      }
    }

    request.professors_approved_count = professorsApprovedCount;
    request.professors_total_count = professorsTotalCount;

    let unresolvedCommentCount = 0;
    let totalCommentCount = 0;
    try {
      const { data: commentData } = await supabase
        .from("clearance_comments")
        .select("id, is_resolved")
        .eq("clearance_request_id", request.request_id || request.id);

      totalCommentCount = (commentData || []).length;
      unresolvedCommentCount = (commentData || []).filter(
        (c) => !c.is_resolved,
      ).length;
    } catch (commentErr) {
      console.warn("Could not fetch comment counts:", commentErr.message);
    }

    res.json({
      success: true,
      hasRequest: true,
      request,
      professorApprovals: approvals,
      unresolvedCommentCount,
      totalCommentCount,
    });
  } catch (error) {
    console.error("Error getting clearance status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/professor/students/:professorId", requireAuth, requireRole("signatory"), async (req, res) => {
  try {
    const { professorId } = req.params;

    const { data: rawApprovals, error } = await supabase
      .from("professor_approvals")
      .select(
        `
        id,
        request_id,
        status,
        comments,
        approved_at,
        professor:professor_id(full_name),
        request:request_id (
          id,
          created_at,
          professors_status,
          library_status,
          cashier_status,
          registrar_status,
          student:student_id (
            id,
            full_name,
            student_number,
            course_year,
            email
          ),
          professor_approvals(id, status, professor:professor_id(full_name))
        )
      `,
      )
      .eq("professor_id", professorId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Professor prerequisites per REG Form 07
    // Undergraduate: Chairman → Dean → DSA → [Library] → [Cashier] → NSTP → [Registrar] → Executive
    // Graduate: [Cashier] → [Library] → [Registrar] → Dean Graduate School
    const UNDERGRAD_PROF_PREREQS = {
      "Department Chairman": [],
      "College Dean": ["Department Chairman"],
      "Director Student Affairs": ["College Dean"],
      "NSTP Director": ["Director Student Affairs"],
      "Executive Officer": ["NSTP Director"],
    };

    const approvals = (rawApprovals || [])
      // Filter out orphaned approvals where the request or student was deleted
      .filter((app) => app.request && app.request.student)
      .map((app) => {
      let is_locked = false;
      const myName = app.professor?.full_name;
      const otherApps = app.request?.professor_approvals || [];

      // Check professor prerequisites
      const prereqs = UNDERGRAD_PROF_PREREQS[myName] || [];
      for (const prereqName of prereqs) {
        const prev = otherApps.find((oa) => oa.professor?.full_name === prereqName);
        if (prev && prev.status !== "approved") {
          is_locked = true;
          break;
        }
      }

      // Interleaved admin stage checks (REG Form 07 order)
      if (!is_locked && app.request) {
        if (myName === "NSTP Director") {
          // Undergrad: NSTP requires Library + Cashier admin approved first
          if (app.request.library_status !== "approved" || app.request.cashier_status !== "approved") {
            is_locked = true;
          }
        } else if (myName === "Executive Officer") {
          // Undergrad: Executive Officer requires Cashier approved (no registrar in undergrad flow)
          if (app.request.cashier_status !== "approved") {
            is_locked = true;
          }
        } else if (myName === "Dean Graduate School") {
          // Graduate: Dean requires all admin stages approved
          if (app.request.cashier_status !== "approved" ||
            app.request.library_status !== "approved" ||
            app.request.registrar_status !== "approved") {
            is_locked = true;
          }
        }
      }

      if (app.request) delete app.request.professor_approvals;
      return { ...app, is_locked };
    });

    res.json({
      success: true,
      approvals,
    });
  } catch (error) {
    console.error("Error getting professor students:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ── G1 FIX: Request Re-evaluation after rejection ────────────────────────────
// Students can request re-evaluation on a rejected stage, resetting it to "pending".
router.post("/request-reevaluation", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const { request_id, stage_type, stage_key, approval_id } = req.body;

    // Ownership check
    const { data: request, error: reqErr } = await supabase
      .from("requests")
      .select("id, student_id, is_completed")
      .eq("id", request_id)
      .single();

    if (reqErr || !request) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }
    if (request.student_id !== req.user.id) {
      return res.status(403).json({ success: false, error: "You can only request re-evaluation for your own clearance" });
    }
    if (request.is_completed) {
      return res.status(400).json({ success: false, error: "Cannot re-evaluate a completed request" });
    }

    if (stage_type === "signatory" && approval_id) {
      // Reset a professor approval from "rejected" to "pending"
      const { data: approval, error: apErr } = await supabase
        .from("professor_approvals")
        .select("id, status, professor_id")
        .eq("id", approval_id)
        .eq("request_id", request_id)
        .single();

      if (apErr || !approval) {
        return res.status(404).json({ success: false, error: "Approval not found" });
      }
      if (approval.status !== "rejected") {
        return res.status(400).json({ success: false, error: "Only rejected stages can be re-evaluated" });
      }

      const { error: updateErr } = await supabase
        .from("professor_approvals")
        .update({ status: "pending", comments: null, updated_at: new Date().toISOString() })
        .eq("id", approval_id);

      if (updateErr) throw updateErr;

      // Notify the signatory
      notifyClearanceStatusChange(request_id, "pending", "Re-evaluation Requested", "Student has requested re-evaluation after rejection.");

      res.json({ success: true, message: "Re-evaluation requested. The signatory has been notified." });
    } else if (stage_type === "stage" && stage_key) {
      // Reset an admin stage (library/cashier/registrar) from "rejected" to "pending"
      const statusField = { library: "library_status", cashier: "cashier_status", registrar: "registrar_status" }[stage_key];
      const commentField = { library: "library_comments", cashier: "cashier_comments", registrar: "registrar_comments" }[stage_key];

      if (!statusField) {
        return res.status(400).json({ success: false, error: "Invalid stage key" });
      }

      // Verify the stage is actually rejected
      const { data: current } = await supabase
        .from("requests")
        .select(statusField)
        .eq("id", request_id)
        .single();

      if (current?.[statusField] !== "rejected") {
        return res.status(400).json({ success: false, error: "Only rejected stages can be re-evaluated" });
      }

      const { error: updateErr } = await supabase
        .from("requests")
        .update({ [statusField]: "pending", [commentField]: null, updated_at: new Date().toISOString() })
        .eq("id", request_id);

      if (updateErr) throw updateErr;

      const stageNames = { library: "Campus Librarian", cashier: "Chief Accountant", registrar: "Record Evaluator" };
      notifyClearanceStatusChange(request_id, "pending", stageNames[stage_key] || stage_key, "Student has requested re-evaluation after rejection.");

      res.json({ success: true, message: "Re-evaluation requested. The reviewer has been notified." });
    } else {
      return res.status(400).json({ success: false, error: "Invalid re-evaluation request" });
    }
  } catch (error) {
    console.error("Error requesting re-evaluation:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/professor/approve", requireAuth, requireRole("signatory"), async (req, res) => {
  try {
    const { approval_id, professor_id, comments } = req.body;

    // S4 FIX: Professors can only approve as themselves
    if (req.user.id !== professor_id) {
      return res.status(403).json({
        success: false,
        error: "You can only approve as yourself",
      });
    }

    // S8 FIX: Comment length validation
    if (comments && comments.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less` });
    }

    const { data, error } = await supabase
      .from("professor_approvals")
      .update({
        status: "approved",
        comments: comments || null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", approval_id)
      .eq("professor_id", professor_id)
      .select()
      .single();

    if (error) throw error;

    // B3 FIX: Use shared completion check instead of inline duplicate logic
    await tryCompleteRequest(data.request_id);

    res.json({
      success: true,
      approval: data,
      message: "Student approved successfully",
    });

    // Fire-and-forget: audit log + email notification + status history
    logAction(professor_id, ACTIONS.CLEARANCE_PROFESSOR_APPROVED, {
      targetId: data.request_id,
      targetType: "request",
      metadata: { approval_id, comments },
    });
    notifyClearanceStatusChange(data.request_id, "approved", "Professor/Signatory", comments);
    logStatusChange(data.request_id, `signatory`, "pending", "approved", professor_id, comments);
  } catch (error) {
    console.error("Error approving student:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/professor/reject", requireAuth, requireRole("signatory"), async (req, res) => {
  try {
    const { approval_id, professor_id, comments } = req.body;

    // S4 FIX: Professors can only reject as themselves
    if (req.user.id !== professor_id) {
      return res.status(403).json({
        success: false,
        error: "You can only reject as yourself",
      });
    }

    if (!comments || comments.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Comments are required when rejecting",
      });
    }

    // S8 FIX: Comment length validation
    if (comments.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less` });
    }

    const { data, error } = await supabase
      .from("professor_approvals")
      .update({
        status: "rejected",
        comments,
        updated_at: new Date().toISOString(),
      })
      .eq("id", approval_id)
      .eq("professor_id", professor_id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      approval: data,
      message: "Student rejected with comments",
    });

    // Fire-and-forget: audit log + email notification + status history
    logAction(professor_id, ACTIONS.CLEARANCE_PROFESSOR_REJECTED, {
      targetId: data.request_id,
      targetType: "request",
      metadata: { approval_id, comments },
    });
    notifyClearanceStatusChange(data.request_id, "rejected", "Professor/Signatory", comments);
    logStatusChange(data.request_id, `signatory`, "pending", "rejected", professor_id, comments);
  } catch (error) {
    console.error("Error rejecting student:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/library/pending", requireAuth, requireRole("librarian"), async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from("requests")
      .select(
        `
        id,
        created_at,
        professors_status,
        library_status,
        cashier_status,
        library_comments,
        student:student_id (
          id,
          full_name,
          student_number,
          course_year,
          email
        ),
        professor_approvals(status, professor:professor_id(full_name))
      `,
      )
      .eq("clearance_type", "graduation")
      .eq("library_status", "pending")
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Filter by REG Form 07 prerequisites
    const UNDERGRAD_NAMES = ["Department Chairman", "College Dean", "Director Student Affairs", "NSTP Director", "Executive Officer"];
    const eligible = (requests || []).filter((req) => {
      const approvals = req.professor_approvals || [];
      const isUndergrad = approvals.some((a) => UNDERGRAD_NAMES.includes(a.professor?.full_name));
      if (isUndergrad) {
        // Undergrad: Library unlocks after Director Student Affairs approves
        const dsa = approvals.find((a) => a.professor?.full_name === "Director Student Affairs");
        return dsa?.status === "approved";
      } else {
        // Graduate: Library unlocks after Chief Accountant (cashier) approves
        return req.cashier_status === "approved";
      }
    });

    const cleanRequests = eligible.map(({ professor_approvals, ...rest }) => rest);
    res.json({
      success: true,
      requests: cleanRequests,
    });
  } catch (error) {
    console.error("Error getting library pending:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/library/approve", requireAuth, requireRole("librarian"), async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

    // S8 FIX: Comment length validation
    if (comments && comments.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less` });
    }

    const { data, error } = await supabase
      .from("requests")
      .update({
        library_status: "approved",
        library_approved_by: admin_id,
        library_approved_at: new Date().toISOString(),
        library_comments: comments || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (error) throw error;

    // B3 FIX: Check if this was the last stage needed for completion
    await tryCompleteRequest(request_id);

    res.json({
      success: true,
      request: data,
      message: "Library clearance approved",
    });

    logAction(admin_id, ACTIONS.CLEARANCE_LIBRARY_APPROVED, {
      targetId: request_id, targetType: "request", metadata: { comments },
    });
    notifyClearanceStatusChange(request_id, "approved", "Campus Librarian", comments);
    logStatusChange(request_id, "library", "pending", "approved", admin_id, comments);
  } catch (error) {
    console.error("Error approving library:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/library/reject", requireAuth, requireRole("librarian"), async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

    if (!comments || comments.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Comments are required when rejecting",
      });
    }

    // S8 FIX: Comment length validation
    if (comments.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less` });
    }

    const { data, error } = await supabase
      .from("requests")
      .update({
        library_status: "rejected",
        library_approved_by: admin_id,
        library_comments: comments,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      request: data,
      message: "Library clearance rejected",
    });

    logAction(admin_id, ACTIONS.CLEARANCE_LIBRARY_REJECTED, {
      targetId: request_id, targetType: "request", metadata: { comments },
    });
    notifyClearanceStatusChange(request_id, "rejected", "Campus Librarian", comments);
    logStatusChange(request_id, "library", "pending", "rejected", admin_id, comments);
  } catch (error) {
    console.error("Error rejecting library:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/cashier/pending", requireAuth, requireRole("cashier"), async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from("requests")
      .select(
        `
        id,
        created_at,
        professors_status,
        library_status,
        cashier_status,
        cashier_comments,
        student:student_id (
          id,
          full_name,
          student_number,
          course_year,
          email
        ),
        professor_approvals(status, professor:professor_id(full_name))
      `,
      )
      .eq("clearance_type", "graduation")
      .eq("cashier_status", "pending")
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Filter by REG Form 07 prerequisites
    const UNDERGRAD_NAMES = ["Department Chairman", "College Dean", "Director Student Affairs", "NSTP Director", "Executive Officer"];
    const eligible = (requests || []).filter((req) => {
      const approvals = req.professor_approvals || [];
      const isUndergrad = approvals.some((a) => UNDERGRAD_NAMES.includes(a.professor?.full_name));
      if (isUndergrad) {
        // Undergrad: Cashier unlocks after Campus Librarian (library) approves
        return req.library_status === "approved";
      } else {
        // Graduate: Cashier is the first step, always available
        return true;
      }
    });

    const cleanRequests = eligible.map(({ professor_approvals, ...rest }) => rest);
    res.json({
      success: true,
      requests: cleanRequests,
    });
  } catch (error) {
    console.error("Error getting cashier pending:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/cashier/approve", requireAuth, requireRole("cashier"), async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

    // S8 FIX: Comment length validation
    if (comments && comments.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less` });
    }

    const { data, error } = await supabase
      .from("requests")
      .update({
        cashier_status: "approved",
        cashier_approved_by: admin_id,
        cashier_approved_at: new Date().toISOString(),
        cashier_comments: comments || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (error) throw error;

    // B3 FIX: Check if this was the last stage needed for completion
    await tryCompleteRequest(request_id);

    res.json({
      success: true,
      request: data,
      message: "Cashier clearance approved",
    });

    logAction(admin_id, ACTIONS.CLEARANCE_CASHIER_APPROVED, {
      targetId: request_id, targetType: "request", metadata: { comments },
    });
    notifyClearanceStatusChange(request_id, "approved", "Chief Accountant", comments);
    logStatusChange(request_id, "cashier", "pending", "approved", admin_id, comments);
  } catch (error) {
    console.error("Error approving cashier:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/cashier/reject", requireAuth, requireRole("cashier"), async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

    if (!comments || comments.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Comments are required when rejecting",
      });
    }

    // S8 FIX: Comment length validation
    if (comments.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less` });
    }

    const { data, error } = await supabase
      .from("requests")
      .update({
        cashier_status: "rejected",
        cashier_approved_by: admin_id,
        cashier_comments: comments,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      request: data,
      message: "Cashier clearance rejected",
    });

    logAction(admin_id, ACTIONS.CLEARANCE_CASHIER_REJECTED, {
      targetId: request_id, targetType: "request", metadata: { comments },
    });
    notifyClearanceStatusChange(request_id, "rejected", "Chief Accountant", comments);
    logStatusChange(request_id, "cashier", "pending", "rejected", admin_id, comments);
  } catch (error) {
    console.error("Error rejecting cashier:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/registrar/pending", requireAuth, requireRole("registrar"), async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from("requests")
      .select(
        `
        id,
        created_at,
        professors_status,
        library_status,
        cashier_status,
        registrar_status,
        registrar_comments,
        certificate_generated,
        student:student_id (
          id,
          full_name,
          student_number,
          course_year,
          email
        ),
        professor_approvals(status, professor:professor_id(full_name))
      `,
      )
      .eq("clearance_type", "graduation")
      .eq("registrar_status", "pending")
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Filter by REG Form 07 prerequisites
    const UNDERGRAD_NAMES = ["Department Chairman", "College Dean", "Director Student Affairs", "NSTP Director", "Executive Officer"];
    const eligible = (requests || []).filter((req) => {
      const approvals = req.professor_approvals || [];
      const isUndergrad = approvals.some((a) => UNDERGRAD_NAMES.includes(a.professor?.full_name));
      if (isUndergrad) {
        // Undergrad: Registrar unlocks after NSTP Director professor approves
        const nstp = approvals.find((a) => a.professor?.full_name === "NSTP Director");
        return nstp?.status === "approved";
      } else {
        // Graduate: Registrar unlocks after Campus Librarian (library) approves
        return req.library_status === "approved";
      }
    });

    const cleanRequests = eligible.map(({ professor_approvals, ...rest }) => rest);
    res.json({
      success: true,
      requests: cleanRequests,
    });
  } catch (error) {
    console.error("Error getting registrar pending:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/registrar/approve", requireAuth, requireRole("registrar"), async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

    // S8 FIX: Comment length validation
    if (comments && comments.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less` });
    }

    const { data, error } = await supabase
      .from("requests")
      .update({
        registrar_status: "approved",
        registrar_approved_by: admin_id,
        registrar_approved_at: new Date().toISOString(),
        registrar_comments: comments || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (error) throw error;

    // B3 FIX: Use shared completion check
    await tryCompleteRequest(request_id);

    // Re-fetch to get updated is_completed status
    const { data: updated } = await supabase
      .from("requests")
      .select("is_completed, certificate_number")
      .eq("id", request_id)
      .single();

    const completed = updated?.is_completed || false;

    res.json({
      success: true,
      request: data,
      certificateNumber: updated?.certificate_number || null,
      message: completed
        ? "Graduation clearance completed and certificate generated"
        : "Registrar approved. Waiting for remaining approvals to complete clearance.",
    });

    logAction(admin_id, ACTIONS.CLEARANCE_REGISTRAR_APPROVED, {
      targetId: request_id, targetType: "request", metadata: { comments, completed, certificateNumber: updated?.certificate_number },
    });
    notifyClearanceStatusChange(request_id, completed ? "completed" : "approved", "Record Evaluator", comments);
    logStatusChange(request_id, "registrar", "pending", "approved", admin_id, comments);
  } catch (error) {
    console.error("Error approving registrar:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/registrar/reject", requireAuth, requireRole("registrar"), async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

    if (!comments || comments.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Comments are required when rejecting",
      });
    }

    // S8 FIX: Comment length validation
    if (comments.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less` });
    }

    const { data, error } = await supabase
      .from("requests")
      .update({
        registrar_status: "rejected",
        registrar_approved_by: admin_id,
        registrar_comments: comments,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      request: data,
      message: "Registrar clearance rejected",
    });

    logAction(admin_id, ACTIONS.CLEARANCE_REGISTRAR_REJECTED, {
      targetId: request_id, targetType: "request", metadata: { comments },
    });
    notifyClearanceStatusChange(request_id, "rejected", "Record Evaluator", comments);
    logStatusChange(request_id, "registrar", "pending", "rejected", admin_id, comments);
  } catch (error) {
    console.error("Error rejecting registrar:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/admin/assign-professor", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const {
      student_id,
      professor_id,
      course_code,
      course_name,
      semester,
      academic_year,
    } = req.body;

    const { data, error } = await supabase
      .from("student_professors")
      .insert({
        student_id,
        professor_id,
        course_code,
        course_name,
        semester,
        academic_year,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      assignment: data,
      message: "Professor assigned successfully",
    });
  } catch (error) {
    console.error("Error assigning professor:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/admin/professors", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { data: professors, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, account_enabled")
      .eq("role", "signatory")
      .order("full_name");

    if (error) throw error;

    res.json({
      success: true,
      professors: professors || [],
    });
  } catch (error) {
    console.error("Error getting professors:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ── G5: Bulk approve/reject for admin stages ─────────────────────────────────
router.post("/bulk-approve", requireAuth, requireRole("librarian", "cashier", "registrar"), async (req, res) => {
  try {
    const { request_ids, admin_id, stage, comments } = req.body;
    // stage must be one of: library, cashier, registrar
    const statusField = { library: "library_status", cashier: "cashier_status", registrar: "registrar_status" }[stage];
    const approvedByField = { library: "library_approved_by", cashier: "cashier_approved_by", registrar: "registrar_approved_by" }[stage];
    const approvedAtField = { library: "library_approved_at", cashier: "cashier_approved_at", registrar: "registrar_approved_at" }[stage];
    const commentField = { library: "library_comments", cashier: "cashier_comments", registrar: "registrar_comments" }[stage];

    if (!statusField || !Array.isArray(request_ids) || request_ids.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid stage or empty request list" });
    }
    if (req.user.id !== admin_id) {
      return res.status(403).json({ success: false, error: "You can only approve as yourself" });
    }

    const results = { approved: [], failed: [] };
    for (const rid of request_ids) {
      const { error } = await supabase
        .from("requests")
        .update({
          [statusField]: "approved",
          [approvedByField]: admin_id,
          [approvedAtField]: new Date().toISOString(),
          [commentField]: comments || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rid)
        .eq(statusField, "pending");

      if (error) {
        results.failed.push(rid);
      } else {
        results.approved.push(rid);
        tryCompleteRequest(rid);
        logStatusChange(rid, stage, "pending", "approved", admin_id, comments);
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error("Bulk approve error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/bulk-reject", requireAuth, requireRole("librarian", "cashier", "registrar"), async (req, res) => {
  try {
    const { request_ids, admin_id, stage, comments } = req.body;
    const statusField = { library: "library_status", cashier: "cashier_status", registrar: "registrar_status" }[stage];
    const approvedByField = { library: "library_approved_by", cashier: "cashier_approved_by", registrar: "registrar_approved_by" }[stage];
    const commentField = { library: "library_comments", cashier: "cashier_comments", registrar: "registrar_comments" }[stage];

    if (!statusField || !Array.isArray(request_ids) || request_ids.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid stage or empty request list" });
    }
    if (!comments || !comments.trim()) {
      return res.status(400).json({ success: false, error: "Comments are required for bulk rejection" });
    }
    if (comments.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ success: false, error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less` });
    }
    if (req.user.id !== admin_id) {
      return res.status(403).json({ success: false, error: "You can only reject as yourself" });
    }

    const results = { rejected: [], failed: [] };
    for (const rid of request_ids) {
      const { error } = await supabase
        .from("requests")
        .update({
          [statusField]: "rejected",
          [approvedByField]: admin_id,
          [commentField]: comments,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rid)
        .eq(statusField, "pending");

      if (error) {
        results.failed.push(rid);
      } else {
        results.rejected.push(rid);
        logStatusChange(rid, stage, "pending", "rejected", admin_id, comments);
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error("Bulk reject error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
