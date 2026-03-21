const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");

router.get("/", requireAuth, requireRole("signatory"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("delegated_to, delegation_expires_at")
      .eq("id", req.user.id)
      .single();

    if (error) throw error;

    let delegate = null;
    if (data.delegated_to) {
      const { data: d } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", data.delegated_to)
        .single();
      delegate = d;
    }

    res.json({
      success: true,
      delegation: {
        delegated_to: data.delegated_to,
        delegation_expires_at: data.delegation_expires_at,
        delegate,
      },
    });
  } catch (error) {
    safeErrorResponse(res, error);
  }
});

router.get(
  "/signatories",
  requireAuth,
  requireRole("signatory"),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "signatory")
        .eq("account_enabled", true)
        .neq("id", req.user.id)
        .order("full_name");

      if (error) throw error;
      res.json({ success: true, signatories: data || [] });
    } catch (error) {
      safeErrorResponse(res, error);
    }
  },
);

router.post("/set", requireAuth, requireRole("signatory"), async (req, res) => {
  try {
    const { delegated_to, expires_at } = req.body;

    if (!delegated_to || !expires_at) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Delegate and expiry date are required",
        });
    }

    const expiryDate = new Date(expires_at);
    if (expiryDate <= new Date()) {
      return res
        .status(400)
        .json({ success: false, error: "Expiry date must be in the future" });
    }

    const { data: delegate } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", delegated_to)
      .eq("role", "signatory")
      .single();

    if (!delegate) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Invalid delegate — must be a signatory",
        });
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        delegated_to,
        delegation_expires_at: expiryDate.toISOString(),
      })
      .eq("id", req.user.id);

    if (error) throw error;

    await supabase.from("notifications").insert({
      user_id: delegated_to,
      type: "info",
      title: "Delegation Assigned",
      message: `You have been designated as a temporary substitute signatory until ${expiryDate.toLocaleDateString()}.`,
    });

    res.json({ success: true, message: "Delegation set successfully" });
  } catch (error) {
    safeErrorResponse(res, error);
  }
});

router.post(
  "/revoke",
  requireAuth,
  requireRole("signatory"),
  async (req, res) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ delegated_to: null, delegation_expires_at: null })
        .eq("id", req.user.id);

      if (error) throw error;
      res.json({ success: true, message: "Delegation revoked" });
    } catch (error) {
      safeErrorResponse(res, error);
    }
  },
);

module.exports = router;
