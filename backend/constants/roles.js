/**
 * Centralized role definitions for the Smart Clearance System.
 *
 * Role hierarchy:
 *   Tier 1 — system_admin  (developer / IT, no app UI)
 *   Tier 2 — super_admin   (university management)
 *   Tier 3 — Staff: librarian, cashier, registrar, signatory
 *   Tier 4 — student
 */

const ROLES = {
  SYSTEM_ADMIN: "system_admin",
  SUPER_ADMIN: "super_admin",
  LIBRARIAN: "librarian",
  CASHIER: "cashier",
  REGISTRAR: "registrar",
  SIGNATORY: "signatory",
  STUDENT: "student",
};

// Roles that process clearances (staff)
const STAFF_ROLES = [
  ROLES.LIBRARIAN,
  ROLES.CASHIER,
  ROLES.REGISTRAR,
  ROLES.SIGNATORY,
];

// Roles that require a secret code to sign up
const SECRET_CODE_ROLES = [
  ROLES.SIGNATORY,
  ROLES.LIBRARIAN,
  ROLES.CASHIER,
  ROLES.REGISTRAR,
];

// Roles with management/admin privileges
const MANAGEMENT_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.SYSTEM_ADMIN,
];

// All roles that can approve/reject clearances
const CLEARANCE_ROLES = [
  ...STAFF_ROLES,
  ROLES.SUPER_ADMIN,
];

/**
 * Check if a role is a staff/clearance-processing role.
 */
function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

/**
 * Check if a role has management privileges (super_admin or system_admin).
 */
function isManagementRole(role) {
  return MANAGEMENT_ROLES.includes(role);
}

/**
 * Check if a role can process clearances (staff + super_admin).
 */
function isClearanceRole(role) {
  return CLEARANCE_ROLES.includes(role);
}

module.exports = {
  ROLES,
  STAFF_ROLES,
  SECRET_CODE_ROLES,
  MANAGEMENT_ROLES,
  CLEARANCE_ROLES,
  isStaffRole,
  isManagementRole,
  isClearanceRole,
};
