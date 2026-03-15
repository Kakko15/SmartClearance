/**
 * Audit Logging Service
 *
 * Logs admin actions to the `audit_log` table for accountability.
 * All writes are fire-and-forget — failures are logged but never block the request.
 *
 * Requires migration: backend/migrations/add_audit_log_table.sql
 */

const supabase = require("../supabaseClient");

async function logAction(actorId, action, { targetId, targetType, metadata } = {}) {
  try {
    await supabase.from("audit_log").insert({
      actor_id: actorId,
      action,
      target_id: targetId || null,
      target_type: targetType || null,
      metadata: metadata || {},
    });
  } catch (error) {
    console.warn(`Audit log failed (${action}):`, error.message);
  }
}

// Pre-defined action constants
const ACTIONS = {
  // Account management
  ACCOUNT_APPROVED: "account_approved",
  ACCOUNT_REJECTED: "account_rejected",
  ACCOUNT_BULK_APPROVED: "account_bulk_approved",
  ACCOUNT_BULK_REJECTED: "account_bulk_rejected",
  // Clearance management
  CLEARANCE_LIBRARY_APPROVED: "clearance_library_approved",
  CLEARANCE_LIBRARY_REJECTED: "clearance_library_rejected",
  CLEARANCE_CASHIER_APPROVED: "clearance_cashier_approved",
  CLEARANCE_CASHIER_REJECTED: "clearance_cashier_rejected",
  CLEARANCE_REGISTRAR_APPROVED: "clearance_registrar_approved",
  CLEARANCE_REGISTRAR_REJECTED: "clearance_registrar_rejected",
  CLEARANCE_PROFESSOR_APPROVED: "clearance_professor_approved",
  CLEARANCE_PROFESSOR_REJECTED: "clearance_professor_rejected",
  CLEARANCE_COMPLETED: "clearance_completed",
  // Secret codes
  SECRET_CODE_CREATED: "secret_code_created",
  SECRET_CODE_TOGGLED: "secret_code_toggled",
  SECRET_CODE_DELETED: "secret_code_deleted",
};

module.exports = { logAction, ACTIONS };
