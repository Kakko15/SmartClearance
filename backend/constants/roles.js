const ROLES = {
  SYSTEM_ADMIN: "system_admin",
  SUPER_ADMIN: "super_admin",
  LIBRARIAN: "librarian",
  CASHIER: "cashier",
  REGISTRAR: "registrar",
  SIGNATORY: "signatory",
  STUDENT: "student",
};

const STAFF_ROLES = [
  ROLES.LIBRARIAN,
  ROLES.CASHIER,
  ROLES.REGISTRAR,
  ROLES.SIGNATORY,
];

const SECRET_CODE_ROLES = [
  ROLES.SIGNATORY,
  ROLES.LIBRARIAN,
  ROLES.CASHIER,
  ROLES.REGISTRAR,
];

const MANAGEMENT_ROLES = [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN];

const CLEARANCE_ROLES = [...STAFF_ROLES, ROLES.SUPER_ADMIN];

function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

function isManagementRole(role) {
  return MANAGEMENT_ROLES.includes(role);
}

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
