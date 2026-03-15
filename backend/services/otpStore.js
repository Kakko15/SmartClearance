/**
 * Persistent OTP/Token Store
 *
 * Replaces in-memory Maps with Supabase `otp_tokens` table.
 * Tokens survive server restarts and work with horizontal scaling.
 *
 * Requires migration: backend/migrations/add_otp_tokens_table.sql
 */

const supabase = require("../supabaseClient");

const TOKEN_TYPES = {
  EMAIL_VERIFY: "email_verify",
  EMAIL_OTP: "email_otp",
  SIGNUP_TOKEN: "signup_token",
};

/**
 * Store a token (upserts — one token per user per type).
 */
async function setToken(userId, tokenType, { tokenValue, email, expiresInMs, maxAttempts = 5 }) {
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

  const { error } = await supabase
    .from("otp_tokens")
    .upsert(
      {
        user_id: userId,
        token_type: tokenType,
        token_value: tokenValue,
        email: email || null,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        attempts: 0,
        max_attempts: maxAttempts,
        setup_used: false,
      },
      { onConflict: "user_id,token_type" },
    );

  if (error) {
    console.error(`otpStore.setToken error (${tokenType}):`, error.message);
    return false;
  }
  return true;
}

/**
 * Get a token. Returns null if not found or expired.
 */
async function getToken(userId, tokenType) {
  const { data, error } = await supabase
    .from("otp_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("token_type", tokenType)
    .single();

  if (error || !data) return null;

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    await deleteToken(userId, tokenType);
    return null;
  }

  return {
    tokenValue: data.token_value,
    email: data.email,
    expiresAt: new Date(data.expires_at).getTime(),
    createdAt: new Date(data.created_at).getTime(),
    attempts: data.attempts,
    maxAttempts: data.max_attempts,
    setupUsed: data.setup_used,
  };
}

/**
 * Increment attempt counter. Returns updated attempts count.
 */
async function incrementAttempts(userId, tokenType) {
  const { data, error } = await supabase
    .from("otp_tokens")
    .select("attempts")
    .eq("user_id", userId)
    .eq("token_type", tokenType)
    .single();

  if (error || !data) return -1;

  const newAttempts = data.attempts + 1;
  await supabase
    .from("otp_tokens")
    .update({ attempts: newAttempts })
    .eq("user_id", userId)
    .eq("token_type", tokenType);

  return newAttempts;
}

/**
 * Mark signup token's setup as used.
 */
async function markSetupUsed(userId) {
  await supabase
    .from("otp_tokens")
    .update({ setup_used: true })
    .eq("user_id", userId)
    .eq("token_type", TOKEN_TYPES.SIGNUP_TOKEN);
}

/**
 * Delete a token.
 */
async function deleteToken(userId, tokenType) {
  await supabase
    .from("otp_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("token_type", tokenType);
}

/**
 * Cleanup all expired tokens (call periodically).
 */
async function cleanupExpired() {
  await supabase
    .from("otp_tokens")
    .delete()
    .lt("expires_at", new Date().toISOString());
}

module.exports = {
  TOKEN_TYPES,
  setToken,
  getToken,
  incrementAttempts,
  markSetupUsed,
  deleteToken,
  cleanupExpired,
};
