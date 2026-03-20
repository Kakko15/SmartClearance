const express = require("express");
const router = express.Router();
const supabase = require("../supabaseClient");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/pending-count", requireAuth, async (req, res) => {
  try {
    const role = req.userRole;
    let count = 0;

    if (role === "librarian") {
      const { data: requests } = await supabase
        .from("requests")
        .select(
          "id, cashier_status, professor_approvals(status, professor:professor_id(full_name))",
        )
        .eq("clearance_type", "graduation")
        .eq("library_status", "pending")
        .eq("is_completed", false);

      const UNDERGRAD_NAMES = [
        "Department Chairman",
        "College Dean",
        "Director Student Affairs",
        "NSTP Director",
        "Executive Officer",
      ];
      count = (requests || []).filter((r) => {
        const approvals = r.professor_approvals || [];
        const isUndergrad = approvals.some((a) =>
          UNDERGRAD_NAMES.includes(a.professor?.full_name),
        );
        if (isUndergrad) {
          const dsa = approvals.find(
            (a) => a.professor?.full_name === "Director Student Affairs",
          );
          return dsa?.status === "approved";
        }
        return r.cashier_status === "approved";
      }).length;
    } else if (role === "cashier") {
      const { data: requests } = await supabase
        .from("requests")
        .select(
          "id, library_status, professor_approvals(status, professor:professor_id(full_name))",
        )
        .eq("clearance_type", "graduation")
        .eq("cashier_status", "pending")
        .eq("is_completed", false);

      const UNDERGRAD_NAMES = [
        "Department Chairman",
        "College Dean",
        "Director Student Affairs",
        "NSTP Director",
        "Executive Officer",
      ];
      count = (requests || []).filter((r) => {
        const approvals = r.professor_approvals || [];
        const isUndergrad = approvals.some((a) =>
          UNDERGRAD_NAMES.includes(a.professor?.full_name),
        );
        if (isUndergrad) return r.library_status === "approved";
        return true;
      }).length;
    } else if (role === "registrar") {
      const { data: requests } = await supabase
        .from("requests")
        .select(
          "id, library_status, professor_approvals(status, professor:professor_id(full_name))",
        )
        .eq("clearance_type", "graduation")
        .eq("registrar_status", "pending")
        .eq("is_completed", false);

      const UNDERGRAD_NAMES = [
        "Department Chairman",
        "College Dean",
        "Director Student Affairs",
        "NSTP Director",
        "Executive Officer",
      ];
      count = (requests || []).filter((r) => {
        const approvals = r.professor_approvals || [];
        const isUndergrad = approvals.some((a) =>
          UNDERGRAD_NAMES.includes(a.professor?.full_name),
        );
        if (isUndergrad) {
          const nstp = approvals.find(
            (a) => a.professor?.full_name === "NSTP Director",
          );
          return nstp?.status === "approved";
        }
        return r.library_status === "approved";
      }).length;
    } else if (role === "signatory") {
      const { data: approvals } = await supabase
        .from("professor_approvals")
        .select(
          `
          id, status,
          professor:professor_id(full_name),
          request:request_id(
            id, library_status, cashier_status, registrar_status, is_completed,
            professor_approvals(id, status, professor:professor_id(full_name))
          )
        `,
        )
        .eq("professor_id", req.user.id)
        .eq("status", "pending");

      const UNDERGRAD_PROF_PREREQS = {
        "Department Chairman": [],
        "College Dean": ["Department Chairman"],
        "Director Student Affairs": ["College Dean"],
        "NSTP Director": ["Director Student Affairs"],
        "Executive Officer": ["NSTP Director"],
      };

      count = (approvals || []).filter((app) => {
        if (!app.request || app.request.is_completed) return false;
        const myName = app.professor?.full_name;
        const otherApps = app.request.professor_approvals || [];

        const prereqs = UNDERGRAD_PROF_PREREQS[myName] || [];
        for (const prereqName of prereqs) {
          const prev = otherApps.find(
            (oa) => oa.professor?.full_name === prereqName,
          );
          if (prev && prev.status !== "approved") return false;
        }

        if (myName === "NSTP Director") {
          if (
            app.request.library_status !== "approved" ||
            app.request.cashier_status !== "approved"
          )
            return false;
        } else if (myName === "Executive Officer") {
          if (app.request.cashier_status !== "approved") return false;
        } else if (myName === "Dean Graduate School") {
          if (
            app.request.cashier_status !== "approved" ||
            app.request.library_status !== "approved" ||
            app.request.registrar_status !== "approved"
          )
            return false;
        }

        return true;
      }).length;
    }

    res.json({ success: true, pendingCount: count });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const unreadCount = (data || []).filter((n) => !n.read_at).length;

    res.json({ success: true, notifications: data || [], unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/read/:id", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/read-all", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", req.user.id)
      .is("read_at", null);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
