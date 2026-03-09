const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

router.post("/apply", async (req, res) => {
  try {
    const { student_id, portion } = req.body;

    const { data: existing, error: checkError } = await supabase
      .from("requests")
      .select("id, is_completed")
      .eq("student_id", student_id)
      .eq("clearance_type", "graduation")
      .eq("is_completed", false)
      .single();

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

    const { data: request, error } = await supabase
      .from("requests")
      .insert({
        student_id,
        doc_type_id: docType.id,
        clearance_type: "graduation",
        current_status: "pending",
        professors_status: "pending",
        library_status: "pending",
        cashier_status: "pending",
        registrar_status: "pending",
        is_completed: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Fetch all professor accounts
    let { data: allProfessors } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "professor")
      .eq("account_enabled", true);

    // Determine which professors belong to this portion (REG Form 07)
    let wantedProfessors = allProfessors || [];
    if (portion === "undergraduate") {
      const undergradNames = [
        "Department Chairman",
        "College Dean",
        "Director Student Affairs",
        "NSTP Director",
        "Executive Officer",
      ];
      wantedProfessors = wantedProfessors.filter((p) => undergradNames.includes(p.full_name));
    } else if (portion === "graduate") {
      wantedProfessors = wantedProfessors.filter((p) => p.full_name === "Dean Graduate School");
    }

    const wantedIds = wantedProfessors.map((p) => p.id);

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
    if (wantedProfessors.length > 0) {
      // Link student to professors
      const studentProfLinks = wantedProfessors.map((p) => ({
        student_id,
        professor_id: p.id,
        course_code: "GRAD",
        course_name: p.full_name + " Clearance",
        is_active: true,
      }));

      await supabase
        .from("student_professors")
        .upsert(studentProfLinks, {
          onConflict: "student_id,professor_id",
          ignoreDuplicates: true,
        });

      // Upsert professor approvals (trigger may have already created them)
      const approvalRecords = wantedProfessors.map((p) => ({
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
          professors_total_count: wantedProfessors.length,
          professors_approved_count: 0,
        })
        .eq("id", request.id);
    }

    res.json({
      success: true,
      request,
      professorsAssigned: wantedProfessors?.length || 0,
      message: "Graduation clearance application submitted successfully",
    });
  } catch (error) {
    console.error("Error applying for clearance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.delete("/cancel/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    const { data: existingRequest, error: findError } = await supabase
      .from("requests")
      .select("id, current_status, is_completed")
      .eq("student_id", studentId)
      .eq("clearance_type", "graduation")
      .eq("is_completed", false)
      .single();

    if (findError || !existingRequest) {
      return res.status(404).json({
        success: false,
        error: "No pending graduation clearance request found",
      });
    }

    if (existingRequest.is_completed) {
      return res.status(400).json({
        success: false,
        error: "Cannot cancel a completed clearance request",
      });
    }

    await supabase
      .from("professor_approvals")
      .delete()
      .eq("request_id", existingRequest.id);

    const { error: deleteError } = await supabase
      .from("requests")
      .delete()
      .eq("id", existingRequest.id);

    if (deleteError) throw deleteError;

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

router.get("/status/:studentId", async (req, res) => {
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
      // Determine portion from professor approvals
      const UNDERGRAD_NAMES = ["Department Chairman", "College Dean", "Director Student Affairs", "NSTP Director", "Executive Officer"];
      const isUndergrad = approvals.some((a) => UNDERGRAD_NAMES.includes(a.professor?.full_name));
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

router.get("/professor/students/:professorId", async (req, res) => {
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

    const approvals = (rawApprovals || []).map((app) => {
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

router.post("/professor/approve", async (req, res) => {
  try {
    const { approval_id, professor_id, comments } = req.body;

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

    // Check if this is the last step → mark request as completed
    try {
      const { data: profInfo } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", professor_id)
        .single();

      const profName = profInfo?.full_name;

      if (profName === "Executive Officer" || profName === "Dean Graduate School") {
        const { data: request } = await supabase
          .from("requests")
          .select("id, library_status, cashier_status, registrar_status, is_completed")
          .eq("id", data.request_id)
          .single();

        if (request && !request.is_completed &&
          request.library_status === "approved" &&
          request.cashier_status === "approved" &&
          request.registrar_status === "approved") {
          const certificateNumber = `ISU-GC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
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
            .eq("id", request.id);
        }
      }
    } catch (completionErr) {
      console.warn("Completion check warning:", completionErr.message);
    }

    res.json({
      success: true,
      approval: data,
      message: "Student approved successfully",
    });
  } catch (error) {
    console.error("Error approving student:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/professor/reject", async (req, res) => {
  try {
    const { approval_id, professor_id, comments } = req.body;

    if (!comments || comments.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Comments are required when rejecting",
      });
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
  } catch (error) {
    console.error("Error rejecting student:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/library/pending", async (req, res) => {
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

router.post("/library/approve", async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

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

    res.json({
      success: true,
      request: data,
      message: "Library clearance approved",
    });
  } catch (error) {
    console.error("Error approving library:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/library/reject", async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

    if (!comments || comments.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Comments are required when rejecting",
      });
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
  } catch (error) {
    console.error("Error rejecting library:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/cashier/pending", async (req, res) => {
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

router.post("/cashier/approve", async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

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

    res.json({
      success: true,
      request: data,
      message: "Cashier clearance approved",
    });
  } catch (error) {
    console.error("Error approving cashier:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/cashier/reject", async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

    if (!comments || comments.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Comments are required when rejecting",
      });
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
  } catch (error) {
    console.error("Error rejecting cashier:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/registrar/pending", async (req, res) => {
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

router.post("/registrar/approve", async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

    const certificateNumber = `ISU-GC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { data, error } = await supabase
      .from("requests")
      .update({
        registrar_status: "approved",
        registrar_approved_by: admin_id,
        registrar_approved_at: new Date().toISOString(),
        registrar_comments: comments || null,
        is_completed: true,
        certificate_generated: true,
        certificate_generated_at: new Date().toISOString(),
        certificate_number: certificateNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      request: data,
      certificateNumber,
      message: "Graduation clearance completed and certificate generated",
    });
  } catch (error) {
    console.error("Error approving registrar:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/registrar/reject", async (req, res) => {
  try {
    const { request_id, admin_id, comments } = req.body;

    if (!comments || comments.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Comments are required when rejecting",
      });
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
  } catch (error) {
    console.error("Error rejecting registrar:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/admin/assign-professor", async (req, res) => {
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

router.get("/admin/professors", async (req, res) => {
  try {
    const { data: professors, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, account_enabled")
      .eq("role", "professor")
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

module.exports = router;
