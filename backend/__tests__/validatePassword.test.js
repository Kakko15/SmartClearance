const { validatePassword } = require("../utils/validatePassword");

// Test-only password fragments — not real credentials
const UPPER = "ABCDEFGH";
const LOWER = "abcdefgh";
const DIGITS = "12345678";
const SPECIAL = "!@#$%^&*";

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
    expect(validatePassword("Ab1!")).toEqual({
      valid: false,
      error: "Password must be at least 8 characters",
    });
  });

  it("rejects password without uppercase letter", () => {
    const result = validatePassword(LOWER + "1!");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/uppercase/i);
  });

  it("rejects password without lowercase letter", () => {
    const result = validatePassword(UPPER + "1!");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/lowercase/i);
  });

  it("rejects password without number", () => {
    const result = validatePassword(UPPER + LOWER + "!");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/number/i);
  });

  it("rejects password without special character", () => {
    const result = validatePassword(UPPER + LOWER + "1");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/special/i);
  });

  it("accepts valid password with all requirements", () => {
    const valid = "Aa" + DIGITS.slice(0, 4) + SPECIAL.slice(0, 2);
    expect(validatePassword(valid)).toEqual({ valid: true });
  });

  it("accepts password with exactly 8 characters meeting all rules", () => {
    const valid = "Aa1!" + LOWER.slice(0, 4);
    expect(validatePassword(valid)).toEqual({ valid: true });
  });
});
