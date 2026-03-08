const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

router.post("/apply", async (req, res) => {
  try {
    const { student_id } = req.body;

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

    const { data: professors } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "professor")
      .eq("account_enabled", true);

    if (professors && professors.length > 0) {
      const studentProfLinks = professors.map((p) => ({
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

      const approvalRecords = professors.map((p) => ({
        request_id: request.id,
        professor_id: p.id,
        status: "pending",
      }));

      const { error: approvalError } = await supabase
        .from("professor_approvals")
        .insert(approvalRecords);

      if (approvalError) {
        console.warn(
          "Professor approvals insert warning:",
          approvalError.message,
        );
      }

      await supabase
        .from("requests")
        .update({
          professors_total_count: professors.length,
          professors_approved_count: 0,
        })
        .eq("id", request.id);
    }

    res.json({
      success: true,
      request,
      professorsAssigned: professors?.length || 0,
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

    if (!request.current_stage) {
      if (request.professors_status !== "approved") {
        request.current_stage = "Professors Approval";
      } else if (request.library_status !== "approved") {
        request.current_stage = "Library Clearance";
      } else if (request.cashier_status !== "approved") {
        request.current_stage = "Cashier Clearance";
      } else if (request.registrar_status !== "approved") {
        request.current_stage = "Registrar Final Approval";
      } else {
        request.current_stage = "Completed";
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

    const PROF_ORDER = [
      "Department Chairman",
      "College Dean",
      "Director Student Affairs",
      "NSTP Director",
      "Executive Officer",
      "Dean Graduate School",
    ];

    const approvals = (rawApprovals || []).map((app) => {
      let is_locked = false;
      const myName = app.professor?.full_name;
      const myIdx = PROF_ORDER.indexOf(myName);

      if (myIdx > 0 && app.request && app.request.professor_approvals) {
        const otherApps = app.request.professor_approvals;
        for (let i = 0; i < myIdx; i++) {
          const prevName = PROF_ORDER[i];
          const prevApp = otherApps.find((oa) => oa.professor?.full_name === prevName);
          if (prevApp && prevApp.status !== "approved") {
            is_locked = true;
            break;
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
        library_comments,
        student:student_id (
          id,
          full_name,
          student_number,
          course_year,
          email
        )
      `,
      )
      .eq("clearance_type", "graduation")
      .eq("professors_status", "approved")
      .eq("library_status", "pending")
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      requests: requests || [],
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
        )
      `,
      )
      .eq("clearance_type", "graduation")
      .eq("library_status", "approved")
      .eq("cashier_status", "pending")
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      requests: requests || [],
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
        )
      `,
      )
      .eq("clearance_type", "graduation")
      .eq("cashier_status", "approved")
      .eq("registrar_status", "pending")
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      requests: requests || [],
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
