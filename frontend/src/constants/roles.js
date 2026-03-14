/**
 * Centralized role definitions for the Smart Clearance System.
 *
 * Role hierarchy:
 *   Tier 1 — system_admin  (developer / IT, no app UI)
 *   Tier 2 — super_admin   (university management)
 *   Tier 3 — Staff: librarian, cashier, registrar, signatory
 *   Tier 4 — student
 */

export const ROLES = {
  SYSTEM_ADMIN: "system_admin",
  SUPER_ADMIN: "super_admin",
  LIBRARIAN: "librarian",
  CASHIER: "cashier",
  REGISTRAR: "registrar",
  SIGNATORY: "signatory",
  STUDENT: "student",
};

export const ROLE_LABELS = {
  [ROLES.SYSTEM_ADMIN]: "System Admin",
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.LIBRARIAN]: "Librarian",
  [ROLES.CASHIER]: "Cashier",
  [ROLES.REGISTRAR]: "Registrar",
  [ROLES.SIGNATORY]: "Signatory",
  [ROLES.STUDENT]: "Student",
};

export const STAFF_ROLES = [
  ROLES.LIBRARIAN,
  ROLES.CASHIER,
  ROLES.REGISTRAR,
  ROLES.SIGNATORY,
];

export const SECRET_CODE_ROLES = [
  ROLES.SIGNATORY,
  ROLES.LIBRARIAN,
  ROLES.CASHIER,
  ROLES.REGISTRAR,
];

export const MANAGEMENT_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.SYSTEM_ADMIN,
];

export const isStaffRole = (role) => STAFF_ROLES.includes(role);
export const isManagementRole = (role) => MANAGEMENT_ROLES.includes(role);
