const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const supabase = require("../supabaseClient");
const { requireAuth } = require("../middleware/authMiddleware");

const { ROLES, isStaffRole, isManagementRole } = require("../constants/roles");

// Only super_admin can manage secret codes
async function requireSuperAdmin(req, res, next) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", req.user.id)
    .single();

  if (!profile || profile.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ success: false, error: "Insufficient permissions" });
  }
  req.adminRole = profile.role;
  next();
}

// List all secret codes
router.get("/", requireAuth, requireSuperAdmin, async (req, res) => {
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

// Generate a new secret code
router.post("/", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { role, description, max_uses = 50, expires_at } = req.body;

    const validRoles = ["signatory", "librarian", "cashier", "registrar"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: "Invalid role" });
    }

    // Generate a high-entropy code: PREFIX-XXXXXX-XXXXXX (12 random hex chars = 48 bits)
    const prefix = { signatory: "SIGN", librarian: "LIB", cashier: "CASH", registrar: "REG" }[role];
    const random = crypto.randomBytes(6).toString("hex").toUpperCase();
    const code = `${prefix}-${random.slice(0, 6)}-${random.slice(6)}`;

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
    res.json({ success: true, code: data });
  } catch (error) {
    console.error("Error creating secret code:", error);
    res.status(500).json({ success: false, error: "Failed to create code" });
  }
});

// Toggle active/revoked status
router.patch("/:id/toggle", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from("admin_secret_codes")
      .select("is_active")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: "Code not found" });
    }

    const { data, error } = await supabase
      .from("admin_secret_codes")
      .update({ is_active: !existing.is_active })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, code: data });
  } catch (error) {
    console.error("Error toggling secret code:", error);
    res.status(500).json({ success: false, error: "Failed to update code" });
  }
});

// Delete a secret code
router.delete("/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("admin_secret_codes")
      .delete()
      .eq("id", id);

    if (error) throw error;
    res.json({ success: true, message: "Code deleted" });
  } catch (error) {
    console.error("Error deleting secret code:", error);
    res.status(500).json({ success: false, error: "Failed to delete code" });
  }
});

module.exports = router;
