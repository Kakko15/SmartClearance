function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
    return {
      valid: false,
      error:
        "Password must contain uppercase, lowercase, number, and special character",
    };
  }

  return { valid: true };
}

module.exports = { validatePassword };
