const { validatePassword } = require("../utils/validatePassword");

describe("validatePassword", () => {
  it("rejects empty password", () => {
    expect(validatePassword("")).toEqual({
      valid: false,
      error: "Password must be at least 8 characters",
    });
  });

  it("rejects undefined password", () => {
    expect(validatePassword(undefined)).toEqual({
      valid: false,
      error: "Password must be at least 8 characters",
    });
  });

  it("rejects password shorter than 8 characters", () => {
    expect(validatePassword("Ab1!xyz")).toEqual({
      valid: false,
      error: "Password must be at least 8 characters",
    });
  });

  it("rejects password without uppercase letter", () => {
    const result = validatePassword("abcdefg1!");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/uppercase/i);
  });

  it("rejects password without lowercase letter", () => {
    const result = validatePassword("ABCDEFG1!");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/lowercase/i);
  });

  it("rejects password without number", () => {
    const result = validatePassword("Abcdefgh!");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/number/i);
  });

  it("rejects password without special character", () => {
    const result = validatePassword("Abcdefg1");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/special/i);
  });

  it("accepts valid password with all requirements", () => {
    expect(validatePassword("Str0ng!Pass")).toEqual({ valid: true });
  });

  it("accepts password with exactly 8 characters meeting all rules", () => {
    expect(validatePassword("Ab1!cdef")).toEqual({ valid: true });
  });
});
