const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const supabase = require("../supabaseClient");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");
const { logAction, ACTIONS } = require("../services/auditService");
const {
  DESIGNATIONS,
  UNDERGRAD_DESIGNATIONS,
  UNDERGRAD_PREREQS,
  isUndergradDesignation,
} = require("../constants/designations");
const {
  resolveUserEmail,
  sendEmail,
  createInAppNotification,
  notifyBulkAction,
  notifyNextStageStaff,
} = require("../services/notificationService");
const { escapeHtml } = require("../utils/escapeHtml");
const {
  MAX_COMMENT_LENGTH,
  DEFAULT_DEADLINE_DAYS,
  logStatusChange,
  notifyStaffOfNewApplication,
  generateCertificateNumber,
  snapshotApprovals,
  restoreApprovals,
  healApprovals,
  tryCompleteRequest,
  notifyClearanceStatusChange,
} = require("../services/graduationHelpers");

const isDev = process.env.NODE_ENV !== "production";

const graduationWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please try again later.",
  },
});

const graduationReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please try again later.",
  },
});

router.use((req, _res, next) => {
  if (req.method === "GET") return graduationReadLimiter(req, _res, next);
  return graduationWriteLimiter(req, _res, next);
});


router.post("/apply", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const {
      student_id,
      portion,
      clearance_intent,
      clearance_intent_others,
      thesis_title,
      semesters_enrolled,
      summers_enrolled,
      student_agreement_accepted,
      nstp_serial_no,
      major,
    } = req.body;

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

    if (
      clearance_intent &&
      clearance_intent.includes("Honorable Dismissal") &&
      !student_agreement_accepted
    ) {
      return res.status(400).json({
        success: false,
        error:
          "You must accept the incomplete grade conversion policy to request Honorable Dismissal.",
      });
    }

    if (nstp_serial_no || major) {
      const updates = {};
      if (nstp_serial_no) updates.nstp_serial_no = nstp_serial_no;
      if (major) updates.major = major;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", student_id);

      if (profileErr) {
        console.warn("Profile update warning (nstp/major):", profileErr.message);
      }
    }

    const { data: existing, error: checkError } = await supabase
      .from("requests")
      .select("id, is_completed")
      .eq("student_id", student_id)
      .eq("clearance_type", "graduation")
      .eq("is_completed", false)
      .maybeSingle();

    if (checkError) throw checkError;

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

    const isUndergrad = portion === "undergraduate";

    const { data: request, error } = await supabase
      .from("requests")
      .insert({
        student_id,
        doc_type_id: docType.id,
        clearance_type: "graduation",
        portion,
        deadline: new Date(
          Date.now() + DEFAULT_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
        current_status: "pending",
        professors_status: "pending",
        library_status: "pending",
        cashier_status: "pending",
        registrar_status: isUndergrad ? "approved" : "pending",
        is_completed: false,

        clearance_intent: clearance_intent || [],
        clearance_intent_others: clearance_intent_others || null,
        thesis_title: thesis_title || null,
        semesters_enrolled: semesters_enrolled || null,
        summers_enrolled: summers_enrolled || null,
        student_agreement_accepted: student_agreement_accepted || false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(400).json({
          success: false,
          error: "You already have a pending graduation clearance request",
        });
      }
      throw error;
    }

    let { data: allSignatories } = await supabase
      .from("profiles")
      .select("id, full_name, designation")
      .eq("role", "signatory")
      .eq("account_enabled", true);

    let wantedSignatories = allSignatories || [];
    if (portion === "undergraduate") {
      wantedSignatories = wantedSignatories.filter((p) =>
        isUndergradDesignation(p.designation),
      );
    } else if (portion === "graduate") {
      wantedSignatories = wantedSignatories.filter(
        (p) => p.designation === DESIGNATIONS.DEAN_GRADUATE_SCHOOL,
      );
    }

    const wantedIds = wantedSignatories.map((p) => p.id);

    // Clean up any unwanted approvals from a prior application attempt
    if (wantedIds.length > 0) {
      const { data: existingApprovals } = await supabase
        .from("professor_approvals")
        .select("id")
        .eq("request_id", request.id)
        .limit(1);

      if (existingApprovals && existingApprovals.length > 0) {
        await supabase
          .from("professor_approvals")
          .delete()
          .eq("request_id", request.id)
          .not("professor_id", "in", `(${wantedIds.join(",")})`);
      }
    }

    if (wantedSignatories.length > 0) {
      const studentSignatoryLinks = wantedSignatories.map((p) => ({
        student_id,
        professor_id: p.id,
        course_code: "GRAD",
        course_name: p.full_name + " Clearance",
        is_active: true,
      }));

      await supabase.from("student_professors").upsert(studentSignatoryLinks, {
        onConflict: "student_id,professor_id",
        ignoreDuplicates: true,
      });

      const approvalRecords = wantedSignatories.map((p) => ({
        request_id: request.id,
        professor_id: p.id,
        status: "pending",
        comments: null,
        approved_at: null,
      }));

      const { error: approvalError } = await supabase
        .from("professor_approvals")
        .upsert(approvalRecords, {
          onConflict: "request_id,professor_id",
        });

      if (approvalError) {
        console.warn(
          "Professor approvals upsert warning:",
          approvalError.message,
        );
      }

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

    try {
      const { data: studentProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", student_id)
        .single();
      notifyStaffOfNewApplication(
        request.id,
        studentProfile?.full_name || "Student",
        portion,
      );

      logStatusChange(
        request.id,
        "application",
        null,
        "pending",
        student_id,
        `${portion} graduation clearance submitted`,
      );
    } catch (postErr) {
      console.warn("Post-response side-effect error (apply):", postErr.message);
    }
  } catch (error) {
    console.error("Error applying for clearance:", error);
    safeErrorResponse(res, error);
  }
});

router.delete(
  "/cancel/:studentId",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    try {
      const { studentId } = req.params;

      if (req.user.id !== studentId) {
        return res.status(403).json({
          success: false,
          error: "You can only cancel your own clearance request",
        });
      }

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

      for (const existingRequest of requests) {
        if (existingRequest.is_completed) continue;

        const reqId = existingRequest.id;

        // Delete clearance_comments
        const { error: commentsDeleteError } = await supabase
          .from("clearance_comments")
          .delete()
          .eq("clearance_request_id", reqId);

        if (commentsDeleteError) {
          console.warn(
            "Clearance comments cleanup warning:",
            commentsDeleteError.message,
          );
        }

        // Delete clearance_status_history
        const { error: historyDeleteError } = await supabase
          .from("clearance_status_history")
          .delete()
          .eq("request_id", reqId);

        if (historyDeleteError) {
          console.warn(
            "Status history cleanup warning:",
            historyDeleteError.message,
          );
        }

        // Delete professor_approvals
        const { error: approvalDeleteError } = await supabase
          .from("professor_approvals")
          .delete()
          .eq("request_id", reqId);

        if (approvalDeleteError) {
          console.warn(
            "Professor approvals cleanup warning:",
            approvalDeleteError.message,
          );
        }

        // Delete request_documents (C-4 fix)
        const { error: docsDeleteError } = await supabase
          .from("request_documents")
          .delete()
          .eq("request_id", reqId);

        if (docsDeleteError) {
          console.warn(
            "Request documents cleanup warning:",
            docsDeleteError.message,
          );
        }

        // Delete request_history (C-4 fix)
        const { error: reqHistoryDeleteError } = await supabase
          .from("request_history")
          .delete()
          .eq("request_id", reqId);

        if (reqHistoryDeleteError) {
          console.warn(
            "Request history cleanup warning:",
            reqHistoryDeleteError.message,
          );
        }

        // Delete escalation_history (C-4 fix)
        const { error: escalationDeleteError } = await supabase
          .from("escalation_history")
          .delete()
          .eq("request_id", reqId);

        if (escalationDeleteError) {
          console.warn(
            "Escalation history cleanup warning:",
            escalationDeleteError.message,
          );
        }

        // Delete clearance_certificates (C-4 fix)
        const { error: certDeleteError } = await supabase
          .from("clearance_certificates")
          .delete()
          .eq("request_id", reqId);

        if (certDeleteError) {
          console.warn(
            "Clearance certificates cleanup warning:",
            certDeleteError.message,
          );
        }

        // Finally, delete the request itself
        const { error: deleteError } = await supabase
          .from("requests")
          .delete()
          .eq("id", reqId);

        if (deleteError) {
          console.error(
            "Failed to delete request:",
            reqId,
            deleteError.message,
          );
          throw deleteError;
        }
      }

      res.json({
        success: true,
        message: "Graduation clearance request cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling clearance:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.get(
  "/status/:studentId",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    try {
      const { studentId } = req.params;

      if (req.user.id !== studentId) {
        return res.status(403).json({
          success: false,
          error: "You can only view your own clearance status",
        });
      }

      let request = null;

      const { data: reqData, error: reqError } = await supabase
        .from("requests")
        .select("*")
        .eq("student_id", studentId)
        .eq("clearance_type", "graduation")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reqError) throw reqError;
      if (reqData) {
        request = { ...reqData, request_id: reqData.id };
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
          designation,
          email,
          avatar_url
        )
      `,
        )
        .eq("request_id", request.request_id || request.id);

      const approvals = await healApprovals(
        professorApprovals || [],
        request.request_id || request.id,
      );
      const professorsApprovedCount = approvals.filter(
        (a) => a.status === "approved",
      ).length;
      const professorsTotalCount = approvals.length;

      {
        const isUndergrad =
          request.portion === "undergraduate" ||
          (!request.portion &&
            approvals.some((a) =>
              isUndergradDesignation(a.professor?.designation),
            ));
        const findProfStatus = (designation) =>
          approvals.find((a) => a.professor?.designation === designation)?.status;

        if (isUndergrad) {
          if (findProfStatus(DESIGNATIONS.DEPARTMENT_CHAIRMAN) !== "approved") {
            request.current_stage = "Department Chairman";
          } else if (findProfStatus(DESIGNATIONS.COLLEGE_DEAN) !== "approved") {
            request.current_stage = "College Dean/Director";
          } else if (
            findProfStatus(DESIGNATIONS.DIRECTOR_STUDENT_AFFAIRS) !== "approved"
          ) {
            request.current_stage = "Director for Student Affairs";
          } else if (request.library_status !== "approved") {
            request.current_stage = "Campus Librarian";
          } else if (request.cashier_status !== "approved") {
            request.current_stage = "Chief Accountant";
          } else if (findProfStatus(DESIGNATIONS.NSTP_DIRECTOR) !== "approved") {
            request.current_stage = "NSTP Director";
          } else if (findProfStatus(DESIGNATIONS.EXECUTIVE_OFFICER) !== "approved") {
            request.current_stage = "Executive Officer";
          } else {
            request.current_stage = "Completed";
          }
        } else {
          if (request.cashier_status !== "approved") {
            request.current_stage = "Chief Accountant";
          } else if (request.library_status !== "approved") {
            request.current_stage = "Campus Librarian";
          } else if (request.registrar_status !== "approved") {
            request.current_stage = "Record Evaluator";
          } else if (findProfStatus(DESIGNATIONS.DEAN_GRADUATE_SCHOOL) !== "approved") {
            request.current_stage = "Dean, Graduate School";
          } else {
            request.current_stage = "Completed";
          }
        }
      }

      request.professors_approved_count = professorsApprovedCount;
      request.professors_total_count = professorsTotalCount;

      if (!request.is_completed && request.current_stage === "Completed") {
        tryCompleteRequest(request.request_id || request.id).catch((err) =>
          console.warn("Auto-complete from status check failed:", err.message),
        );
      }

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
      safeErrorResponse(res, error);
    }
  },
);

router.get(
  "/professor/students/:professorId",
  requireAuth,
  requireRole("signatory"),
  async (req, res) => {
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
        professor:professor_id(full_name, designation),
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
          professor_approvals(id, status, approved_at, professor_id, professor:professor_id(full_name, designation))
        )
      `,
        )
        .eq("professor_id", professorId)
        .order("created_at", { ascending: false });

      if (error) throw error;



      const healedRawApprovals = [];
      for (const app of (rawApprovals || []).filter(
        (a) => a.request && a.request.student,
      )) {
        const healedSelf = (await healApprovals([app], app.request_id))[0];

        if (healedSelf.request?.professor_approvals) {
          healedSelf.request.professor_approvals = await healApprovals(
            healedSelf.request.professor_approvals,
            healedSelf.request_id,
          );
        }
        healedRawApprovals.push(healedSelf);
      }

      const approvals = healedRawApprovals.map((app) => {
        let is_locked = false;
        const myDesignation = app.professor?.designation;
        const otherApps = app.request?.professor_approvals || [];

        const prereqs = UNDERGRAD_PREREQS[myDesignation] || [];
        for (const prereqDesig of prereqs) {
          const prev = otherApps.find(
            (oa) => oa.professor?.designation === prereqDesig,
          );
          if (prev && prev.status !== "approved") {
            is_locked = true;
            break;
          }
        }

        if (!is_locked && app.request) {
          if (myDesignation === DESIGNATIONS.NSTP_DIRECTOR) {
            if (
              app.request.library_status !== "approved" ||
              app.request.cashier_status !== "approved"
            ) {
              is_locked = true;
            }
          } else if (myDesignation === DESIGNATIONS.EXECUTIVE_OFFICER) {
            if (app.request.cashier_status !== "approved") {
              is_locked = true;
            }
          } else if (myDesignation === DESIGNATIONS.DEAN_GRADUATE_SCHOOL) {
            if (
              app.request.cashier_status !== "approved" ||
              app.request.library_status !== "approved" ||
              app.request.registrar_status !== "approved"
            ) {
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
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/request-reevaluation",
  requireAuth,
  requireRole("student"),
  async (req, res) => {
    try {
      const { request_id, stage_type, stage_key, approval_id } = req.body;

      const { data: request, error: reqErr } = await supabase
        .from("requests")
        .select("id, student_id, is_completed")
        .eq("id", request_id)
        .single();

      if (reqErr || !request) {
        return res
          .status(404)
          .json({ success: false, error: "Request not found" });
      }
      if (request.student_id !== req.user.id) {
        return res
          .status(403)
          .json({
            success: false,
            error: "You can only request re-evaluation for your own clearance",
          });
      }
      if (request.is_completed) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Cannot re-evaluate a completed request",
          });
      }

      if (stage_type === "signatory" && approval_id) {
        const { data: approval, error: apErr } = await supabase
          .from("professor_approvals")
          .select("id, status, professor_id")
          .eq("id", approval_id)
          .eq("request_id", request_id)
          .single();

        if (apErr || !approval) {
          return res
            .status(404)
            .json({ success: false, error: "Approval not found" });
        }
        if (approval.status !== "rejected") {
          return res
            .status(400)
            .json({
              success: false,
              error: "Only rejected stages can be re-evaluated",
            });
        }

        const { error: updateErr } = await supabase
          .from("professor_approvals")
          .update({
            status: "pending",
            comments: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", approval_id);

        if (updateErr) throw updateErr;

        notifyClearanceStatusChange(
          request_id,
          "pending",
          "Re-evaluation Requested",
          "Student has requested re-evaluation after rejection.",
        );

        res.json({
          success: true,
          message: "Re-evaluation requested. The signatory has been notified.",
        });
      } else if (stage_type === "stage" && stage_key) {
        const statusField = {
          library: "library_status",
          cashier: "cashier_status",
          registrar: "registrar_status",
        }[stage_key];
        const commentField = {
          library: "library_comments",
          cashier: "cashier_comments",
          registrar: "registrar_comments",
        }[stage_key];

        if (!statusField) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid stage key" });
        }

        const { data: current } = await supabase
          .from("requests")
          .select(statusField)
          .eq("id", request_id)
          .single();

        if (current?.[statusField] !== "rejected") {
          return res
            .status(400)
            .json({
              success: false,
              error: "Only rejected stages can be re-evaluated",
            });
        }

        const preSnapshot = await snapshotApprovals(request_id);

        const { error: updateErr } = await supabase
          .from("requests")
          .update({
            [statusField]: "pending",
            [commentField]: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", request_id);

        if (updateErr) throw updateErr;

        await restoreApprovals(request_id, preSnapshot);

        const stageNames = {
          library: "Campus Librarian",
          cashier: "Chief Accountant",
          registrar: "Record Evaluator",
        };
        notifyClearanceStatusChange(
          request_id,
          "pending",
          stageNames[stage_key] || stage_key,
          "Student has requested re-evaluation after rejection.",
        );

        notifyNextStageStaff(request_id, stage_key);

        res.json({
          success: true,
          message: "Re-evaluation requested. The reviewer has been notified.",
        });
      } else {
        return res
          .status(400)
          .json({ success: false, error: "Invalid re-evaluation request" });
      }
    } catch (error) {
      console.error("Error requesting re-evaluation:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/professor/approve",
  requireAuth,
  requireRole("signatory"),
  async (req, res) => {
    try {
      const { approval_id, professor_id, comments } = req.body;

      if (req.user.id !== professor_id) {
        const { data: delegator } = await supabase
          .from("profiles")
          .select("delegated_to, delegation_expires_at")
          .eq("id", professor_id)
          .single();

        const isActiveDelegate =
          delegator &&
          delegator.delegated_to === req.user.id &&
          delegator.delegation_expires_at &&
          new Date(delegator.delegation_expires_at) > new Date();

        if (!isActiveDelegate) {
          return res.status(403).json({
            success: false,
            error: "You can only approve as yourself or as an active delegate",
          });
        }
      }

      if (comments && comments.length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less`,
          });
      }

      const { data: currentApproval, error: fetchErr } = await supabase
        .from("professor_approvals")
        .select("id, request_id, status, professor:professor_id(full_name, designation)")
        .eq("id", approval_id)
        .eq("professor_id", professor_id)
        .single();

      if (fetchErr || !currentApproval) {
        return res
          .status(404)
          .json({ success: false, error: "Approval record not found" });
      }

      const { data: requestCheck } = await supabase
        .from("requests")
        .select("is_completed")
        .eq("id", currentApproval.request_id)
        .single();

      if (requestCheck?.is_completed) {
        return res
          .status(400)
          .json({ success: false, error: "Request is already completed" });
      }

      const myDesignation = currentApproval.professor?.designation;

      const prereqs = UNDERGRAD_PREREQS[myDesignation] || [];
      if (prereqs.length > 0) {
        const { data: rawPrereqApprovals } = await supabase
          .from("professor_approvals")
          .select(
            "status, approved_at, professor_id, professor:professor_id(full_name, designation)",
          )
          .eq("request_id", currentApproval.request_id);

        const allApprovals = await healApprovals(
          rawPrereqApprovals || [],
          currentApproval.request_id,
        );

        for (const prereqDesig of prereqs) {
          const prev = allApprovals.find(
            (a) => a.professor?.designation === prereqDesig,
          );
          if (!prev || prev.status !== "approved") {
            return res.status(400).json({
              success: false,
              error: `Cannot approve yet — ${prereqDesig} must approve first`,
            });
          }
        }
      }

      if (
        [DESIGNATIONS.NSTP_DIRECTOR, DESIGNATIONS.EXECUTIVE_OFFICER, DESIGNATIONS.DEAN_GRADUATE_SCHOOL].includes(
          myDesignation,
        )
      ) {
        const { data: request } = await supabase
          .from("requests")
          .select("library_status, cashier_status, registrar_status")
          .eq("id", currentApproval.request_id)
          .single();

        if (request) {
          if (
            myDesignation === DESIGNATIONS.NSTP_DIRECTOR &&
            (request.library_status !== "approved" ||
              request.cashier_status !== "approved")
          ) {
            return res
              .status(400)
              .json({
                success: false,
                error:
                  "Cannot approve yet — Library and Cashier must approve first",
              });
          }
          if (
            myDesignation === DESIGNATIONS.EXECUTIVE_OFFICER &&
            request.cashier_status !== "approved"
          ) {
            return res
              .status(400)
              .json({
                success: false,
                error: "Cannot approve yet — Cashier must approve first",
              });
          }
          if (
            myDesignation === DESIGNATIONS.DEAN_GRADUATE_SCHOOL &&
            (request.cashier_status !== "approved" ||
              request.library_status !== "approved" ||
              request.registrar_status !== "approved")
          ) {
            return res
              .status(400)
              .json({
                success: false,
                error:
                  "Cannot approve yet — all admin stages must approve first",
              });
          }
        }
      }

      const preSnapshot = await snapshotApprovals(currentApproval.request_id);

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

      const updatedSnapshot = preSnapshot.map((s) =>
        s.id === approval_id
          ? {
              ...s,
              status: "approved",
              comments: comments || null,
              approved_at: data.approved_at,
            }
          : s,
      );

      await restoreApprovals(currentApproval.request_id, updatedSnapshot);

      await tryCompleteRequest(data.request_id);

      res.json({
        success: true,
        approval: data,
        message: "Student approved successfully",
      });

      try {
        logAction(professor_id, ACTIONS.CLEARANCE_PROFESSOR_APPROVED, {
          targetId: data.request_id,
          targetType: "request",
          metadata: { approval_id, comments },
        });

        const { data: profProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", professor_id)
          .single();
        const stageName = profProfile?.full_name || "Professor/Signatory";
        notifyClearanceStatusChange(
          data.request_id,
          "approved",
          stageName,
          comments,
        );
        logStatusChange(
          data.request_id,
          `signatory`,
          "pending",
          "approved",
          professor_id,
          comments,
        );
      } catch (postErr) {
        console.warn("Post-response side-effect error (professor/approve):", postErr.message);
      }
    } catch (error) {
      console.error("Error approving student:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/professor/reject",
  requireAuth,
  requireRole("signatory"),
  async (req, res) => {
    try {
      const { approval_id, professor_id, comments } = req.body;

      if (req.user.id !== professor_id) {
        const { data: delegator } = await supabase
          .from("profiles")
          .select("delegated_to, delegation_expires_at")
          .eq("id", professor_id)
          .single();

        const isActiveDelegate =
          delegator &&
          delegator.delegated_to === req.user.id &&
          delegator.delegation_expires_at &&
          new Date(delegator.delegation_expires_at) > new Date();

        if (!isActiveDelegate) {
          return res.status(403).json({
            success: false,
            error: "You can only reject as yourself or as an active delegate",
          });
        }
      }

      if (!comments || comments.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Comments are required when rejecting",
        });
      }

      if (comments.length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less`,
          });
      }

      const { data: currentApproval, error: fetchErr } = await supabase
        .from("professor_approvals")
        .select("id, request_id")
        .eq("id", approval_id)
        .eq("professor_id", professor_id)
        .single();

      if (fetchErr || !currentApproval) {
        return res
          .status(404)
          .json({ success: false, error: "Approval record not found" });
      }

      const preSnapshot = await snapshotApprovals(currentApproval.request_id);

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

      const updatedSnapshot = preSnapshot.map((s) =>
        s.id === approval_id ? { ...s, status: "rejected", comments } : s,
      );

      await restoreApprovals(data.request_id, updatedSnapshot);

      res.json({
        success: true,
        approval: data,
        message: "Student rejected with comments",
      });

      try {
        logAction(professor_id, ACTIONS.CLEARANCE_PROFESSOR_REJECTED, {
          targetId: data.request_id,
          targetType: "request",
          metadata: { approval_id, comments },
        });

        const { data: profProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", professor_id)
          .single();
        const stageName = profProfile?.full_name || "Professor/Signatory";
        notifyClearanceStatusChange(
          data.request_id,
          "rejected",
          stageName,
          comments,
        );
        logStatusChange(
          data.request_id,
          `signatory`,
          "pending",
          "rejected",
          professor_id,
          comments,
        );
      } catch (postErr) {
        console.warn("Post-response side-effect error (professor/reject):", postErr.message);
      }
    } catch (error) {
      console.error("Error rejecting student:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.get(
  "/library/pending",
  requireAuth,
  requireRole("librarian"),
  async (req, res) => {
    try {
      const { data: requests, error } = await supabase
        .from("requests")
        .select(
          `
        id,
        created_at,
        portion,
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
        professor_approvals(id, status, approved_at, professor_id, professor:professor_id(full_name))
      `,
        )
        .eq("clearance_type", "graduation")
        .eq("library_status", "pending")
        .eq("is_completed", false)
        .order("created_at", { ascending: true });

      if (error) throw error;

      for (const request of requests || []) {
        if (request.professor_approvals) {
          request.professor_approvals = await healApprovals(
            request.professor_approvals,
            request.id,
          );
        }
      }

      const eligible = (requests || []).filter((req) => {
        const approvals = req.professor_approvals || [];

        const isUndergrad =
          req.portion === "undergraduate" ||
          (!req.portion &&
            approvals.some((a) =>
              isUndergradDesignation(a.professor?.designation),
            ));
        if (isUndergrad) {
          const dsa = approvals.find(
            (a) => a.professor?.designation === DESIGNATIONS.DIRECTOR_STUDENT_AFFAIRS,
          );
          return dsa?.status === "approved";
        } else {
          return req.cashier_status === "approved";
        }
      });

      const cleanRequests = eligible.map(
        ({ professor_approvals, ...rest }) => rest,
      );
      res.json({
        success: true,
        requests: cleanRequests,
      });
    } catch (error) {
      console.error("Error getting library pending:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/library/approve",
  requireAuth,
  requireRole("librarian"),
  async (req, res) => {
    try {
      const { request_id, comments } = req.body;
      const admin_id = req.user.id;

      if (comments && comments.length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less`,
          });
      }

      const preSnapshot = await snapshotApprovals(request_id);

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

      await restoreApprovals(request_id, preSnapshot);

      await tryCompleteRequest(request_id);

      res.json({
        success: true,
        request: data,
        message: "Library clearance approved",
      });

      try {
        logAction(admin_id, ACTIONS.CLEARANCE_LIBRARY_APPROVED, {
          targetId: request_id,
          targetType: "request",
          metadata: { comments },
        });
        notifyClearanceStatusChange(
          request_id,
          "approved",
          "Campus Librarian",
          comments,
        );
        logStatusChange(
          request_id,
          "library",
          "pending",
          "approved",
          admin_id,
          comments,
        );
      } catch (postErr) {
        console.warn("Post-response side-effect error (library/approve):", postErr.message);
      }
    } catch (error) {
      console.error("Error approving library:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/library/reject",
  requireAuth,
  requireRole("librarian"),
  async (req, res) => {
    try {
      const { request_id, comments } = req.body;
      const admin_id = req.user.id;

      if (!comments || comments.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Comments are required when rejecting",
        });
      }

      if (comments.length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less`,
          });
      }

      const preSnapshot = await snapshotApprovals(request_id);

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

      await restoreApprovals(request_id, preSnapshot);

      res.json({
        success: true,
        request: data,
        message: "Library clearance rejected",
      });

      try {
        logAction(admin_id, ACTIONS.CLEARANCE_LIBRARY_REJECTED, {
          targetId: request_id,
          targetType: "request",
          metadata: { comments },
        });
        notifyClearanceStatusChange(
          request_id,
          "rejected",
          "Campus Librarian",
          comments,
        );
        logStatusChange(
          request_id,
          "library",
          "pending",
          "rejected",
          admin_id,
          comments,
        );
      } catch (postErr) {
        console.warn("Post-response side-effect error (library/reject):", postErr.message);
      }
    } catch (error) {
      console.error("Error rejecting library:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.get(
  "/cashier/pending",
  requireAuth,
  requireRole("cashier"),
  async (req, res) => {
    try {
      const { data: requests, error } = await supabase
        .from("requests")
        .select(
          `
        id,
        created_at,
        portion,
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
        professor_approvals(id, status, approved_at, professor_id, professor:professor_id(full_name))
      `,
        )
        .eq("clearance_type", "graduation")
        .eq("cashier_status", "pending")
        .eq("is_completed", false)
        .order("created_at", { ascending: true });

      if (error) throw error;

      for (const request of requests || []) {
        if (request.professor_approvals) {
          request.professor_approvals = await healApprovals(
            request.professor_approvals,
            request.id,
          );
        }
      }

      const eligible = (requests || []).filter((req) => {
        const approvals = req.professor_approvals || [];
        const isUndergrad =
          req.portion === "undergraduate" ||
          (!req.portion &&
            approvals.some((a) =>
              isUndergradDesignation(a.professor?.designation),
            ));
        if (isUndergrad) {
          return req.library_status === "approved";
        } else {
          return true;
        }
      });

      const cleanRequests = eligible.map(
        ({ professor_approvals, ...rest }) => rest,
      );
      res.json({
        success: true,
        requests: cleanRequests,
      });
    } catch (error) {
      console.error("Error getting cashier pending:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/cashier/approve",
  requireAuth,
  requireRole("cashier"),
  async (req, res) => {
    try {
      const { request_id, comments } = req.body;
      const admin_id = req.user.id;

      if (comments && comments.length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less`,
          });
      }

      const preSnapshot = await snapshotApprovals(request_id);

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

      await restoreApprovals(request_id, preSnapshot);

      await tryCompleteRequest(request_id);

      res.json({
        success: true,
        request: data,
        message: "Cashier clearance approved",
      });

      try {
        logAction(admin_id, ACTIONS.CLEARANCE_CASHIER_APPROVED, {
          targetId: request_id,
          targetType: "request",
          metadata: { comments },
        });
        notifyClearanceStatusChange(
          request_id,
          "approved",
          "Chief Accountant",
          comments,
        );
        logStatusChange(
          request_id,
          "cashier",
          "pending",
          "approved",
          admin_id,
          comments,
        );
      } catch (postErr) {
        console.warn("Post-response side-effect error (cashier/approve):", postErr.message);
      }
    } catch (error) {
      console.error("Error approving cashier:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/cashier/reject",
  requireAuth,
  requireRole("cashier"),
  async (req, res) => {
    try {
      const { request_id, comments } = req.body;
      const admin_id = req.user.id;

      if (!comments || comments.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Comments are required when rejecting",
        });
      }

      if (comments.length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less`,
          });
      }

      const preSnapshot = await snapshotApprovals(request_id);

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

      await restoreApprovals(request_id, preSnapshot);

      res.json({
        success: true,
        request: data,
        message: "Cashier clearance rejected",
      });

      try {
        logAction(admin_id, ACTIONS.CLEARANCE_CASHIER_REJECTED, {
          targetId: request_id,
          targetType: "request",
          metadata: { comments },
        });
        notifyClearanceStatusChange(
          request_id,
          "rejected",
          "Chief Accountant",
          comments,
        );
        logStatusChange(
          request_id,
          "cashier",
          "pending",
          "rejected",
          admin_id,
          comments,
        );
      } catch (postErr) {
        console.warn("Post-response side-effect error (cashier/reject):", postErr.message);
      }
    } catch (error) {
      console.error("Error rejecting cashier:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.get(
  "/registrar/pending",
  requireAuth,
  requireRole("registrar"),
  async (req, res) => {
    try {
      const { data: requests, error } = await supabase
        .from("requests")
        .select(
          `
        id,
        created_at,
        portion,
        professors_status,
        library_status,
        cashier_status,
        registrar_status,
        registrar_comments,
        certificate_generated,
        clearance_intent,
        clearance_intent_others,
        thesis_title,
        semesters_enrolled,
        summers_enrolled,
        student:student_id (
          id,
          full_name,
          student_number,
          course_year,
          email,
          nstp_serial_no,
          major
        ),
        professor_approvals(id, status, approved_at, professor_id, professor:professor_id(full_name))
      `,
        )
        .eq("clearance_type", "graduation")
        .eq("registrar_status", "pending")
        .eq("is_completed", false)
        .order("created_at", { ascending: true });

      if (error) throw error;

      for (const request of requests || []) {
        if (request.professor_approvals) {
          request.professor_approvals = await healApprovals(
            request.professor_approvals,
            request.id,
          );
        }
      }

      const eligible = (requests || []).filter((req) => {
        const approvals = req.professor_approvals || [];
        const isUndergrad =
          req.portion === "undergraduate" ||
          (!req.portion &&
            approvals.some((a) =>
              isUndergradDesignation(a.professor?.designation),
            ));
        if (isUndergrad) {
          const nstp = approvals.find(
            (a) => a.professor?.designation === DESIGNATIONS.NSTP_DIRECTOR,
          );
          return nstp?.status === "approved";
        } else {
          return req.library_status === "approved";
        }
      });

      const cleanRequests = eligible.map(
        ({ professor_approvals, ...rest }) => rest,
      );
      res.json({
        success: true,
        requests: cleanRequests,
      });
    } catch (error) {
      console.error("Error getting registrar pending:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/registrar/approve",
  requireAuth,
  requireRole("registrar"),
  async (req, res) => {
    try {
      const { request_id, comments } = req.body;
      const admin_id = req.user.id;

      if (comments && comments.length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less`,
          });
      }

      const preSnapshot = await snapshotApprovals(request_id);

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

      await restoreApprovals(request_id, preSnapshot);

      await tryCompleteRequest(request_id);

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

      try {
        logAction(admin_id, ACTIONS.CLEARANCE_REGISTRAR_APPROVED, {
          targetId: request_id,
          targetType: "request",
          metadata: {
            comments,
            completed,
            certificateNumber: updated?.certificate_number,
          },
        });
        notifyClearanceStatusChange(
          request_id,
          completed ? "completed" : "approved",
          "Record Evaluator",
          comments,
        );
        logStatusChange(
          request_id,
          "registrar",
          "pending",
          "approved",
          admin_id,
          comments,
        );
      } catch (postErr) {
        console.warn("Post-response side-effect error (registrar/approve):", postErr.message);
      }
    } catch (error) {
      console.error("Error approving registrar:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/registrar/reject",
  requireAuth,
  requireRole("registrar"),
  async (req, res) => {
    try {
      const { request_id, comments } = req.body;
      const admin_id = req.user.id;

      if (!comments || comments.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Comments are required when rejecting",
        });
      }

      if (comments.length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less`,
          });
      }

      const preSnapshot = await snapshotApprovals(request_id);

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

      await restoreApprovals(request_id, preSnapshot);

      res.json({
        success: true,
        request: data,
        message: "Registrar clearance rejected",
      });

      try {
        logAction(admin_id, ACTIONS.CLEARANCE_REGISTRAR_REJECTED, {
          targetId: request_id,
          targetType: "request",
          metadata: { comments },
        });
        notifyClearanceStatusChange(
          request_id,
          "rejected",
          "Record Evaluator",
          comments,
        );
        logStatusChange(
          request_id,
          "registrar",
          "pending",
          "rejected",
          admin_id,
          comments,
        );
      } catch (postErr) {
        console.warn("Post-response side-effect error (registrar/reject):", postErr.message);
      }
    } catch (error) {
      console.error("Error rejecting registrar:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/admin/assign-professor",
  requireAuth,
  requireRole("super_admin"),
  async (req, res) => {
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
      safeErrorResponse(res, error);
    }
  },
);

router.get(
  "/admin/professors",
  requireAuth,
  requireRole("super_admin"),
  async (req, res) => {
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
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/bulk-approve",
  requireAuth,
  requireRole("librarian", "cashier", "registrar"),
  async (req, res) => {
    try {
      const { request_ids, stage, comments } = req.body;
      const admin_id = req.user.id;

      const statusField = {
        library: "library_status",
        cashier: "cashier_status",
        registrar: "registrar_status",
      }[stage];
      const approvedByField = {
        library: "library_approved_by",
        cashier: "cashier_approved_by",
        registrar: "registrar_approved_by",
      }[stage];
      const approvedAtField = {
        library: "library_approved_at",
        cashier: "cashier_approved_at",
        registrar: "registrar_approved_at",
      }[stage];
      const commentField = {
        library: "library_comments",
        cashier: "cashier_comments",
        registrar: "registrar_comments",
      }[stage];
      const stageDisplayName =
        {
          library: "Campus Librarian",
          cashier: "Chief Accountant",
          registrar: "Record Evaluator",
        }[stage] || stage;

      if (
        !statusField ||
        !Array.isArray(request_ids) ||
        request_ids.length === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Invalid stage or empty request list",
          });
      }
      if (request_ids.length > 100) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Cannot bulk approve more than 100 requests at once",
          });
      }

      const results = { approved: [], failed: [] };
      for (const rid of request_ids) {
        const preSnapshot = await snapshotApprovals(rid);

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
          await restoreApprovals(rid, preSnapshot);
          results.approved.push(rid);
          await tryCompleteRequest(rid);
          logStatusChange(
            rid,
            stage,
            "pending",
            "approved",
            admin_id,
            comments,
          );
        }
      }

      try {
        notifyBulkAction(results.approved, "approved", stageDisplayName);
      } catch (notifyErr) {
        console.warn("Bulk approve notification failed:", notifyErr.message);
      }

      const partialSuccess = results.failed.length > 0 && results.approved.length > 0;
      res.json({
        success: true,
        partialSuccess,
        results,
        message: partialSuccess
          ? `${results.approved.length} approved, ${results.failed.length} failed`
          : `${results.approved.length} approved successfully`,
      });
    } catch (error) {
      console.error("Bulk approve error:", error);
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/bulk-reject",
  requireAuth,
  requireRole("librarian", "cashier", "registrar"),
  async (req, res) => {
    try {
      const { request_ids, stage, comments } = req.body;
      const admin_id = req.user.id;
      const statusField = {
        library: "library_status",
        cashier: "cashier_status",
        registrar: "registrar_status",
      }[stage];
      const approvedByField = {
        library: "library_approved_by",
        cashier: "cashier_approved_by",
        registrar: "registrar_approved_by",
      }[stage];
      const commentField = {
        library: "library_comments",
        cashier: "cashier_comments",
        registrar: "registrar_comments",
      }[stage];
      const stageDisplayName =
        {
          library: "Campus Librarian",
          cashier: "Chief Accountant",
          registrar: "Record Evaluator",
        }[stage] || stage;

      if (
        !statusField ||
        !Array.isArray(request_ids) ||
        request_ids.length === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Invalid stage or empty request list",
          });
      }
      if (request_ids.length > 100) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Cannot bulk reject more than 100 requests at once",
          });
      }
      if (!comments || !comments.trim()) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Comments are required for bulk rejection",
          });
      }
      if (comments.length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json({
            success: false,
            error: `Comments must be ${MAX_COMMENT_LENGTH} characters or less`,
          });
      }

      const results = { rejected: [], failed: [] };
      for (const rid of request_ids) {
        const preSnapshot = await snapshotApprovals(rid);

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
          await restoreApprovals(rid, preSnapshot);
          results.rejected.push(rid);
          logStatusChange(
            rid,
            stage,
            "pending",
            "rejected",
            admin_id,
            comments,
          );
        }
      }

      try {
        notifyBulkAction(results.rejected, "rejected", stageDisplayName);
      } catch (notifyErr) {
        console.warn("Bulk reject notification failed:", notifyErr.message);
      }

      const partialSuccess = results.failed.length > 0 && results.rejected.length > 0;
      res.json({
        success: true,
        partialSuccess,
        results,
        message: partialSuccess
          ? `${results.rejected.length} rejected, ${results.failed.length} failed`
          : `${results.rejected.length} rejected successfully`,
      });
    } catch (error) {
      console.error("Bulk reject error:", error);
      safeErrorResponse(res, error);
    }
  },
);

module.exports = router;
