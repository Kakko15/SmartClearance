const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const supabase = require("../supabaseClient");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const { logAction, ACTIONS } = require("../services/auditService");

const { ROLES } = require("../constants/roles");


router.get("/", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("admin_secret_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ success: true, codes: data || [] });
  } catch (error) {
    console.error("Error fetching secret codes:", error);
    res.status(500).json({ success: false, error: "Failed to fetch codes" });
  }
});

router.post("/", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { role, description, max_uses = 50, expires_at } = req.body;

    const validRoles = ["signatory", "librarian", "cashier", "registrar"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: "Invalid role" });
    }

    const prefix = {
      signatory: "SIGN",
      librarian: "LIB",
      cashier: "CASH",
      registrar: "REG",
    }[role];
    const random = crypto
      .randomBytes(16)
      .toString("base64url")
      .toUpperCase()
      .slice(0, 16);
    const code = `${prefix}-${random.slice(0, 8)}-${random.slice(8)}`;

    const { data, error } = await supabase
      .from("admin_secret_codes")
      .insert({
        code,
        role,
        description: description || `${prefix} signup code`,
        is_active: true,
        max_uses: Math.min(Math.max(max_uses, 1), 1000),
        current_uses: 0,
        ...(expires_at ? { expires_at } : {}),
      })
      .select()
      .single();

    if (error) throw error;
    logAction(req.user.id, ACTIONS.SECRET_CODE_CREATED, {
      targetId: data.id,
      targetType: "secret_code",
      metadata: { role, code },
    });
    res.json({ success: true, code: data });
  } catch (error) {
    console.error("Error creating secret code:", error);
    res.status(500).json({ success: false, error: "Failed to create code" });
  }
});

router.patch(
  "/:id/toggle",
  requireAuth,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { data: existing, error: fetchError } = await supabase
        .from("admin_secret_codes")
        .select("is_active")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return res
          .status(404)
          .json({ success: false, error: "Code not found" });
      }

      const { data, error } = await supabase
        .from("admin_secret_codes")
        .update({ is_active: !existing.is_active })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      logAction(req.user.id, ACTIONS.SECRET_CODE_TOGGLED, {
        targetId: id,
        targetType: "secret_code",
        metadata: { newState: !existing.is_active },
      });
      res.json({ success: true, code: data });
    } catch (error) {
      console.error("Error toggling secret code:", error);
      res.status(500).json({ success: false, error: "Failed to update code" });
    }
  },
);

router.delete("/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("admin_secret_codes")
      .delete()
      .eq("id", id);

    if (error) throw error;
    logAction(req.user.id, ACTIONS.SECRET_CODE_DELETED, {
      targetId: id,
      targetType: "secret_code",
    });
    res.json({ success: true, message: "Code deleted" });
  } catch (error) {
    console.error("Error deleting secret code:", error);
    res.status(500).json({ success: false, error: "Failed to delete code" });
  }
});

module.exports = router;
