function validatePassword(password) {
  if (typeof password !== "string" || !password || password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }

  if (password.length > 128) {
    return { valid: false, error: "Password must be 128 characters or fewer" };
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
