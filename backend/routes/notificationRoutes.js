const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const supabase = require("../supabaseClient");
const { requireAuth } = require("../middleware/authMiddleware");
const { safeErrorResponse } = require("../utils/safeError");
const {
  DESIGNATIONS,
  UNDERGRAD_PREREQS,
  isUndergradDesignation,
} = require("../constants/designations");

const isDev = process.env.NODE_ENV !== "production";

const notifWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

const notifReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

router.use((req, _res, next) => {
  if (req.method === "GET") return notifReadLimiter(req, _res, next);
  return notifWriteLimiter(req, _res, next);
});

router.get("/pending-count", requireAuth, async (req, res) => {
  try {
    const role = req.userRole;
    let count = 0;

    if (!["librarian", "cashier", "registrar", "signatory"].includes(role)) {
      return res.json({ success: true, pendingCount: 0 });
    }

    if (role === "librarian") {
      const { data: requests } = await supabase
        .from("requests")
        .select(
          "id, cashier_status, professor_approvals(status, professor:professor_id(designation))",
        )
        .eq("clearance_type", "graduation")
        .eq("library_status", "pending")
        .eq("is_completed", false);

      count = (requests || []).filter((r) => {
        const approvals = r.professor_approvals || [];
        const isUndergrad = approvals.some((a) =>
          isUndergradDesignation(a.professor?.designation),
        );
        if (isUndergrad) {
          const dsa = approvals.find(
            (a) => a.professor?.designation === DESIGNATIONS.DIRECTOR_STUDENT_AFFAIRS,
          );
          return dsa?.status === "approved";
        }
        return r.cashier_status === "approved";
      }).length;
    } else if (role === "cashier") {
      const { data: requests } = await supabase
        .from("requests")
        .select(
          "id, library_status, professor_approvals(status, professor:professor_id(designation))",
        )
        .eq("clearance_type", "graduation")
        .eq("cashier_status", "pending")
        .eq("is_completed", false);

      count = (requests || []).filter((r) => {
        const approvals = r.professor_approvals || [];
        const isUndergrad = approvals.some((a) =>
          isUndergradDesignation(a.professor?.designation),
        );
        if (isUndergrad) return r.library_status === "approved";
        return true;
      }).length;
    } else if (role === "registrar") {
      const { data: requests } = await supabase
        .from("requests")
        .select(
          "id, library_status, professor_approvals(status, professor:professor_id(designation))",
        )
        .eq("clearance_type", "graduation")
        .eq("registrar_status", "pending")
        .eq("is_completed", false);

      count = (requests || []).filter((r) => {
        const approvals = r.professor_approvals || [];
        const isUndergrad = approvals.some((a) =>
          isUndergradDesignation(a.professor?.designation),
        );
        if (isUndergrad) {
          const nstp = approvals.find(
            (a) => a.professor?.designation === DESIGNATIONS.NSTP_DIRECTOR,
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
          professor:professor_id(full_name, designation),
          request:request_id(
            id, library_status, cashier_status, registrar_status, is_completed,
            professor_approvals(id, status, professor:professor_id(full_name, designation))
          )
        `,
        )
        .eq("professor_id", req.user.id)
        .eq("status", "pending");

      count = (approvals || []).filter((app) => {
        if (!app.request || app.request.is_completed) return false;
        const myDesignation = app.professor?.designation;
        const otherApps = app.request.professor_approvals || [];

        const prereqs = UNDERGRAD_PREREQS[myDesignation] || [];
        for (const prereqDesig of prereqs) {
          const prev = otherApps.find(
            (oa) => oa.professor?.designation === prereqDesig,
          );
          if (prev && prev.status !== "approved") return false;
        }

        if (myDesignation === DESIGNATIONS.NSTP_DIRECTOR) {
          if (
            app.request.library_status !== "approved" ||
            app.request.cashier_status !== "approved"
          )
            return false;
        } else if (myDesignation === DESIGNATIONS.EXECUTIVE_OFFICER) {
          if (app.request.cashier_status !== "approved") return false;
        } else if (myDesignation === DESIGNATIONS.DEAN_GRADUATE_SCHOOL) {
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
    safeErrorResponse(res, error);
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
    safeErrorResponse(res, error);
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
    safeErrorResponse(res, error);
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
    safeErrorResponse(res, error);
  }
});

module.exports = router;
