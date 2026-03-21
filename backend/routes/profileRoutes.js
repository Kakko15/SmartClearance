const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");

const SENSITIVE_FIELDS = ["full_name", "student_number", "course_year"];

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, role, student_number, course_year, account_enabled, nstp_serial_no, major",
      )
      .eq("id", req.user.id)
      .single();

    if (error) throw error;
    res.json({ success: true, profile: data });
  } catch (error) {
    safeErrorResponse(res, error);
  }
});

router.post("/request-edit", requireAuth, async (req, res) => {
  try {
    const { field_name, new_value } = req.body;

    if (!field_name || !new_value?.trim()) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Field name and new value are required",
        });
    }

    if (!SENSITIVE_FIELDS.includes(field_name)) {
      return res.status(400).json({ success: false, error: "Invalid field" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(field_name)
      .eq("id", req.user.id)
      .single();

    const oldValue = profile?.[field_name] || "";

    const { data: existing } = await supabase
      .from("profile_edit_requests")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("field_name", field_name)
      .eq("status", "pending")
      .limit(1);

    if (existing?.length > 0) {
      return res
        .status(409)
        .json({
          success: false,
          error: "You already have a pending request for this field",
        });
    }

    const { data, error } = await supabase
      .from("profile_edit_requests")
      .insert({
        user_id: req.user.id,
        field_name,
        old_value: oldValue,
        new_value: new_value.trim(),
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, request: data });
  } catch (error) {
    safeErrorResponse(res, error);
  }
});

router.get("/edit-requests", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profile_edit_requests")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, requests: data || [] });
  } catch (error) {
    safeErrorResponse(res, error);
  }
});

router.get(
  "/pending-edits",
  requireAuth,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("profile_edit_requests")
        .select(
          "*, profiles!profile_edit_requests_user_id_fkey(full_name, student_number, role)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;
      res.json({ success: true, requests: data || [] });
    } catch (error) {
      safeErrorResponse(res, error);
    }
  },
);

router.post(
  "/review-edit/:id",
  requireAuth,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { action, comment } = req.body;

      if (!["approved", "rejected"].includes(action)) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Action must be 'approved' or 'rejected'",
          });
      }

      const { data: editReq, error: fetchErr } = await supabase
        .from("profile_edit_requests")
        .select("*")
        .eq("id", req.params.id)
        .eq("status", "pending")
        .single();

      if (fetchErr || !editReq) {
        return res
          .status(404)
          .json({
            success: false,
            error: "Edit request not found or already reviewed",
          });
      }

      const { error: updateErr } = await supabase
        .from("profile_edit_requests")
        .update({
          status: action,
          reviewed_by: req.user.id,
          reviewed_at: new Date().toISOString(),
          admin_comment: comment || null,
        })
        .eq("id", req.params.id);

      if (updateErr) throw updateErr;

      if (action === "approved") {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ [editReq.field_name]: editReq.new_value })
          .eq("id", editReq.user_id);

        if (profileErr) throw profileErr;
      }

      await supabase.from("notifications").insert({
        user_id: editReq.user_id,
        type: action === "approved" ? "success" : "warning",
        title: `Profile Edit ${action === "approved" ? "Approved" : "Rejected"}`,
        message: `Your request to change ${editReq.field_name.replace(/_/g, " ")} has been ${action}.${comment ? ` Comment: ${comment}` : ""}`,
      });

      res.json({ success: true, message: `Edit request ${action}` });
    } catch (error) {
      safeErrorResponse(res, error);
    }
  },
);

module.exports = router;
