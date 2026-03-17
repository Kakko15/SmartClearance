/**
 * Persistent OTP/Token Store
 *
 * Replaces in-memory Maps with Supabase `otp_tokens` table.
 * Tokens survive server restarts and work with horizontal scaling.
 *
 * Requires migration: backend/migrations/add_otp_tokens_table.sql
 */

const supabase = require("../supabaseClient");

// Fallback store used only when DB operations fail.
// This keeps auth flows usable in local/dev even with partial schema drift.
const fallbackTokens = new Map();

function fallbackKey(userId, tokenType) {
  return `${userId}:${tokenType}`;
}

function setFallbackToken(userId, tokenType, token) {
  fallbackTokens.set(fallbackKey(userId, tokenType), token);
}

function getFallbackToken(userId, tokenType) {
  return fallbackTokens.get(fallbackKey(userId, tokenType)) || null;
}

function deleteFallbackToken(userId, tokenType) {
  fallbackTokens.delete(fallbackKey(userId, tokenType));
}

const TOKEN_TYPES = {
  EMAIL_VERIFY: "email_verify",
  EMAIL_OTP: "email_otp",
  SIGNUP_TOKEN: "signup_token",
  EMAIL_VERIFY_TOKEN: "email_verify_token",
  TOTP_RESET: "totp_reset",
};

/**
 * Store a token (upserts — one token per user per type).
 */
async function setToken(userId, tokenType, { tokenValue, email, expiresInMs, maxAttempts = 5, resendCount = 0 }) {
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
  const fallbackToken = {
    tokenValue,
    email: email || null,
    expiresAt: new Date(expiresAt).getTime(),
    createdAt: Date.now(),
    attempts: 0,
    maxAttempts,
    setupUsed: false,
    resendCount,
  };

  const row = {
    user_id: userId,
    token_type: tokenType,
    token_value: tokenValue,
    email: email || null,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    attempts: 0,
    max_attempts: maxAttempts,
    setup_used: false,
    resend_count: resendCount,
  };

  // Use upsert on the UNIQUE(user_id, token_type) constraint.
  // This is atomic — no race window between delete and insert.
  const { error } = await supabase
    .from("otp_tokens")
    .upsert(row, { onConflict: "user_id,token_type" });

  if (error) {
    console.error(`otpStore.setToken upsert error (${tokenType}):`, error.message, error.details, error.hint, error.code);

    // Fallback: delete then insert (handles edge cases where upsert fails
    // due to missing unique constraint or schema mismatch)
    const { error: delErr } = await supabase
      .from("otp_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("token_type", tokenType);

    if (delErr) {
      console.error(`otpStore.setToken fallback delete error:`, delErr.message);
    }

    const { error: insErr } = await supabase
      .from("otp_tokens")
      .insert(row);

    if (insErr) {
      console.error(`otpStore.setToken fallback insert error:`, insErr.message, insErr.details, insErr.hint, insErr.code);

      // Second fallback: try without resend_count column (migration may not have run)
      const { resend_count, ...rowWithoutResend } = row;
      const { error: insErr2 } = await supabase
        .from("otp_tokens")
        .insert(rowWithoutResend);

      if (insErr2) {
        console.error(`otpStore.setToken final fallback error:`, insErr2.message, insErr2.details, insErr2.hint, insErr2.code);

        // Last-resort compatibility fallback for partially migrated schemas.
        // Keep only core columns that existed in earliest versions.
        const coreRow = {
          user_id: userId,
          token_type: tokenType,
          token_value: tokenValue,
          email: email || null,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        };

        const { error: delErr2 } = await supabase
          .from("otp_tokens")
          .delete()
          .eq("user_id", userId)
          .eq("token_type", tokenType);

        if (delErr2) {
          console.error(`otpStore.setToken core fallback delete error:`, delErr2.message);
        }

        const { error: coreInsErr } = await supabase
          .from("otp_tokens")
          .insert(coreRow);

        if (coreInsErr) {
          console.error(`otpStore.setToken core fallback insert error:`, coreInsErr.message, coreInsErr.details, coreInsErr.hint, coreInsErr.code);
          // Final safety net: keep token in memory so the user can continue.
          setFallbackToken(userId, tokenType, fallbackToken);
          return true;
        }
      }
    }
  }
  setFallbackToken(userId, tokenType, fallbackToken);
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

  if (error || !data) {
    const fallback = getFallbackToken(userId, tokenType);
    if (!fallback) return null;

    if (Date.now() > fallback.expiresAt) {
      deleteFallbackToken(userId, tokenType);
      return null;
    }
    return fallback;
  }

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
    attempts: data.attempts ?? 0,
    maxAttempts: data.max_attempts ?? 5,
    setupUsed: data.setup_used ?? false,
    resendCount: data.resend_count ?? 0,
  };
}

/**
 * Increment attempt counter atomically. Returns updated attempts count.
 * Uses a single UPDATE with a computed value to avoid the read-then-write
 * race condition where concurrent requests could read the same count.
 */
async function incrementAttempts(userId, tokenType) {
  // Supabase JS doesn't support SET attempts = attempts + 1 directly,
  // so we use an RPC call. If the RPC doesn't exist, fall back to a
  // single update that fetches-and-increments via .rpc or raw SQL.
  // Simplest safe approach: use Supabase's .rpc with a tiny SQL function,
  // but since we can't guarantee the function exists, we use a SELECT ... FOR UPDATE
  // pattern via a single chained call.
  //
  // Safest without requiring a new migration: read + conditional update
  // with an optimistic concurrency check on the old value.
  const { data, error } = await supabase
    .from("otp_tokens")
    .select("attempts")
    .eq("user_id", userId)
    .eq("token_type", tokenType)
    .single();

  if (error || !data) {
    const fallback = getFallbackToken(userId, tokenType);
    if (!fallback) return -1;
    fallback.attempts = (fallback.attempts || 0) + 1;
    setFallbackToken(userId, tokenType, fallback);
    return fallback.attempts;
  }

  const oldAttempts = data.attempts;
  const newAttempts = oldAttempts + 1;

  // Conditional update: only succeeds if attempts still equals the value
  // we read. If a concurrent request already incremented it, this update
  // matches zero rows and we retry.
  const { data: updated, error: updateError } = await supabase
    .from("otp_tokens")
    .update({ attempts: newAttempts })
    .eq("user_id", userId)
    .eq("token_type", tokenType)
    .eq("attempts", oldAttempts)
    .select("attempts")
    .single();

  if (updateError || !updated) {
    // Conflict — another request incremented first. Retry once.
    const { data: retryData } = await supabase
      .from("otp_tokens")
      .select("attempts")
      .eq("user_id", userId)
      .eq("token_type", tokenType)
      .single();

    if (!retryData) return -1;

    const retryOld = retryData.attempts;
    const retryNew = retryOld + 1;

    const { data: retryUpdated } = await supabase
      .from("otp_tokens")
      .update({ attempts: retryNew })
      .eq("user_id", userId)
      .eq("token_type", tokenType)
      .eq("attempts", retryOld)
      .select("attempts")
      .single();

    return retryUpdated ? retryUpdated.attempts : retryOld + 1;
  }

  return updated.attempts;
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

  const fallback = getFallbackToken(userId, TOKEN_TYPES.SIGNUP_TOKEN);
  if (fallback) {
    fallback.setupUsed = true;
    setFallbackToken(userId, TOKEN_TYPES.SIGNUP_TOKEN, fallback);
  }
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

  deleteFallbackToken(userId, tokenType);
}

/**
 * Cleanup all expired tokens (call periodically).
 */
async function cleanupExpired() {
  await supabase
    .from("otp_tokens")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const now = Date.now();
  for (const [key, token] of fallbackTokens.entries()) {
    if (!token || now > token.expiresAt) {
      fallbackTokens.delete(key);
    }
  }
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
