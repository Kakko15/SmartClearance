const supabase = require("../supabaseClient");
const { isStaffRole, isManagementRole, ROLES } = require("../constants/roles");

const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .single();
  if (error) throw new Error("User not found");
  return data;
};

const isAdminRole = (role) => {
  return isStaffRole(role) || isManagementRole(role);
};

const isSignatoryRole = (role) => {
  return role === ROLES.SIGNATORY;
};

const filterByVisibility = (comments, userRole) => {
  return comments.filter((comment) => {
    if (comment.visibility === "all") return true;
    if (comment.visibility === "admins_only") return isAdminRole(userRole);
    if (comment.visibility === "professors_only")
      return isSignatoryRole(userRole);
    return true;
  });
};

module.exports = {
  getUserProfile,
  isAdminRole,
  isSignatoryRole,
  filterByVisibility,
};
