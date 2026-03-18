const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { generateSecret, verifySync, generateURI } = require("otplib");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const supabase = require("../supabaseClient");

const { requireAuth } = require("../middleware/authMiddleware");

const { TOKEN_TYPES, setToken, getToken, incrementAttempts, deleteToken, markSetupUsed } = require("../services/otpStore");

const isDev = process.env.NODE_ENV !== "production";

/**
 * Middleware: ensures req.body.userId matches the authenticated user (req.user.id).
 * Must be used AFTER requireAuth.
 */
function requireMatchingUserId(req, res, next) {
  const { userId } = req.body;
  if (!userId || userId !== req.user.id) {
    return res.status(403).json({ success: false, error: "User ID mismatch" });
  }
  next();
}

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// ── Signup tokens: short-lived, single-use tokens issued after account creation ──
const SIGNUP_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes — enough for 2FA setup + email verification

async function generateSignupToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await setToken(userId, TOKEN_TYPES.SIGNUP_TOKEN, {
    tokenValue: token,
    expiresInMs: SIGNUP_TOKEN_EXPIRY_MS,
  });
  return token;
}

async function validateSignupToken(userId, token) {
  const stored = await getToken(userId, TOKEN_TYPES.SIGNUP_TOKEN);
  if (!stored) return { valid: false, reason: "No signup token found. Please sign up again." };
  if (Date.now() > stored.expiresAt) {
    await deleteToken(userId, TOKEN_TYPES.SIGNUP_TOKEN);
    return { valid: false, reason: "Signup token expired. Please sign up again." };
  }
  if (stored.tokenValue !== token) return { valid: false, reason: "Invalid signup token." };
  return { valid: true, setupUsed: stored.setupUsed };
}

// Expose for authRoutes to call after signup
router.generateSignupToken = generateSignupToken;
router.validateSignupToken = validateSignupToken;

const verifyTotpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 30 : 10,
  message: {
    success: false,
    error: "Too many verification attempts. Please try again in 15 minutes.",
  },
  keyGenerator: (req) => req.body?.userId || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
});

const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 20 : 5,
  message: {
    success: false,
    error: "Too many OTP requests. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 30 : 10,
  message: {
    success: false,
    error: "Too many verification attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// B9 FIX: Singleton transporter — reuse SMTP connection across all emails.
let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return _transporter;
}

// Warm up SMTP connection on module load so first email is fast
try {
  const t = getTransporter();
  t.verify().then(() => {
    console.log("[SMTP] Connection pool ready");
  }).catch((err) => {
    console.warn("[SMTP] Warm-up failed (will retry on first send):", err.message);
  });
} catch (_) { /* ignore */ }

router.post("/setup", async (req, res) => {
  try {
    const { userId, email, signupToken } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ success: false, error: "User ID and email are required" });
    }

    if (!signupToken) {
      return res.status(401).json({ success: false, error: "Signup token is required" });
    }

    // Validate the short-lived signup token
    const tokenCheck = await validateSignupToken(userId, signupToken);
    if (!tokenCheck.valid) {
      return res.status(401).json({ success: false, error: tokenCheck.reason });
    }

    // Mark setup as used — only one /setup call per signup token
    if (tokenCheck.setupUsed) {
      return res.status(401).json({ success: false, error: "2FA setup already initiated. Please verify your code." });
    }
    await markSetupUsed(userId);

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: "SmartClearance",
      label: email,
      secret,
      type: "totp",
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    const { error } = await supabase
      .from("profiles")
      .update({ totp_secret: secret, totp_enabled: false })
      .eq("id", userId);

    if (error) {
      console.error("Failed to save TOTP secret:", error);
      return res.status(500).json({ success: false, error: "Failed to save 2FA secret" });
    }

    res.json({
      success: true,
      qrCode: qrCodeDataUrl,
      manualKey: secret,
      otpauthUrl,
    });
  } catch (error) {
    console.error("2FA setup error:", error);
    res.status(500).json({ success: false, error: "Failed to setup 2FA" });
  }
});

router.post("/verify-setup", async (req, res) => {
  try {
    const { userId, token, signupToken } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ success: false, error: "User ID and token are required" });
    }

    if (!signupToken) {
      return res.status(401).json({ success: false, error: "Signup token is required" });
    }

    // Validate the signup token (must be same one used for /setup)
    const tokenCheck = await validateSignupToken(userId, signupToken);
    if (!tokenCheck.valid) {
      return res.status(401).json({ success: false, error: tokenCheck.reason });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("totp_secret")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.totp_secret) {
      return res.status(400).json({ success: false, error: "2FA not initialized. Please restart setup." });
    }

    const setupResult = verifySync({ token: token.toString(), secret: profile.totp_secret, epochTolerance: 30 });

    if (!setupResult || !setupResult.valid) {
      return res.status(400).json({ success: false, error: "Invalid code. Please check your authenticator app and try again." });
    }

    await supabase
      .from("profiles")
      .update({ totp_enabled: true })
      .eq("id", userId);

    // Cleanup: signup token is no longer needed
    await deleteToken(userId, TOKEN_TYPES.SIGNUP_TOKEN);

    res.json({ success: true, message: "2FA enabled successfully" });
  } catch (error) {
    console.error("2FA verify-setup error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

router.post("/verify-totp", requireAuth, requireMatchingUserId, verifyTotpLimiter, async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ success: false, error: "User ID and token are required" });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("totp_secret, totp_enabled")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.totp_secret || !profile?.totp_enabled) {
      return res.status(400).json({ success: false, error: "2FA is not enabled for this account" });
    }

    const loginResult = verifySync({ token: token.toString(), secret: profile.totp_secret, epochTolerance: 30 });

    if (!loginResult || !loginResult.valid) {
      console.error("TOTP verify failed for user:", userId, "result:", JSON.stringify(loginResult));
      return res.status(400).json({ success: false, error: "Invalid code. Please try again." });
    }

    res.json({ success: true, message: "2FA verified" });
  } catch (error) {
    console.error("2FA verify-totp error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

router.post("/send-email-otp", requireAuth, requireMatchingUserId, sendOtpLimiter, async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ success: false, error: "User ID and email are required" });
    }

    // Exponential backoff: track resend count in the existing token
    let existing = null;
    try {
      existing = await getToken(userId, TOKEN_TYPES.EMAIL_OTP);
    } catch (getErr) {
      console.error("[send-email-otp] getToken error:", getErr.message);
      // Continue — treat as no existing token
    }
    const resendCount = existing?.resendCount || 0;

    // Cooldown: 30s first, then 60s, 120s, max 300s
    const cooldownMs = Math.min(30000 * Math.pow(2, resendCount), 300000);

    if (existing && (Date.now() - existing.createdAt) < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - (Date.now() - existing.createdAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSec} seconds before requesting a new code.`,
        retryAfter: waitSec,
      });
    }

    // setToken handles delete-then-insert internally
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const newResendCount = existing ? resendCount + 1 : 0;
    // Next cooldown for the frontend to display
    const nextCooldownMs = Math.min(30000 * Math.pow(2, newResendCount), 300000);

    console.log("[send-email-otp] Storing OTP for user:", userId);
    const stored = await setToken(userId, TOKEN_TYPES.EMAIL_OTP, {
      tokenValue: otp,
      email,
      expiresInMs: OTP_EXPIRY_MS,
      maxAttempts: OTP_MAX_ATTEMPTS,
      resendCount: newResendCount,
    });

    if (!stored) {
      console.error("[send-email-otp] Failed to store OTP for user:", userId);
      return res.status(500).json({ success: false, error: "Failed to create verification code. Please try again." });
    }

    // Respond immediately — send email in the background so the UI feels instant
    res.json({
      success: true,
      message: "Verification code sent to your email",
      expiresIn: OTP_EXPIRY_MS,
      resendCooldown: Math.round(nextCooldownMs / 1000),
    });

    // Fire-and-forget: send the email after responding
    const expiryMinutes = Math.round(OTP_EXPIRY_MS / 60000);
    const transporter = getTransporter();

    const { buildGoogleEmail, getLogoAttachment } = require("../utils/emailTemplate");
    const htmlBody = buildGoogleEmail(
      "Login Verification",
      "Identity verification",
      "You are currently requesting a verification code to access your SmartClearance account. Use the code below to complete your sign-in:",
      {
        code: otp,
        footerNote: `This code expires in <strong>${expiryMinutes} minutes</strong>. If you didn't request this attempt, you can safely ignore this email.`
      }
    );

    transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Your Login Verification Code - SmartClearance",
      html: htmlBody,
      attachments: getLogoAttachment(),
    }).catch((emailErr) => {
      console.error("[send-email-otp] Background email send failed:", emailErr.message);
    });
  } catch (error) {
    console.error("Send email OTP error:", error.message, error.stack);
    // Distinguish email delivery failures from other errors
    const isEmailError = error?.code === "ECONNREFUSED" || error?.code === "EAUTH" ||
      error?.responseCode >= 400 || error?.command === "CONN";
    res.status(500).json({
      success: false,
      error: isEmailError
        ? "Failed to send verification email. Please check your email address and try again."
        : "Failed to send verification code. Please try again.",
    });
  }
});

router.post("/verify-email-otp", requireAuth, requireMatchingUserId, verifyOtpLimiter, async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ success: false, error: "User ID and OTP are required" });
    }

    const stored = await getToken(userId, TOKEN_TYPES.EMAIL_OTP);

    if (!stored) {
      console.error("Email OTP not found for user:", userId, "- token may have expired or was never created");
      return res.status(400).json({ success: false, error: "No verification code found. Please request a new one.", expired: true });
    }

    if (Date.now() > stored.expiresAt) {
      await deleteToken(userId, TOKEN_TYPES.EMAIL_OTP);
      return res.status(400).json({ success: false, error: "Code expired. Please request a new one.", expired: true });
    }

    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      await deleteToken(userId, TOKEN_TYPES.EMAIL_OTP);
      return res.status(429).json({ success: false, error: "Too many failed attempts. Please request a new code.", locked: true });
    }

    if (stored.tokenValue !== otp.toString()) {
      console.error("Email OTP mismatch for user:", userId, "expected length:", stored.tokenValue.length, "got length:", otp.toString().length);
      const newAttempts = await incrementAttempts(userId, TOKEN_TYPES.EMAIL_OTP);
      const remaining = OTP_MAX_ATTEMPTS - newAttempts;
      if (remaining <= 0) {
        await deleteToken(userId, TOKEN_TYPES.EMAIL_OTP);
        return res.status(429).json({ success: false, error: "Too many failed attempts. Please request a new code.", locked: true, attemptsRemaining: 0 });
      }
      return res.status(400).json({
        success: false,
        error: `Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        attemptsRemaining: remaining,
      });
    }

    await deleteToken(userId, TOKEN_TYPES.EMAIL_OTP);
    res.json({ success: true, message: "2FA verified" });
  } catch (error) {
    console.error("Verify email OTP error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

// ── Reset Authenticator: for logged-in users who lost their authenticator app ──
router.post("/reset-setup", requireAuth, requireMatchingUserId, async (req, res) => {
  try {
    const { userId, email, password } = req.body;

    if (!userId || !email || !password) {
      return res.status(400).json({ success: false, error: "User ID, email, and password are required" });
    }

    // Verify password using a temporary client to avoid polluting the shared client's auth state
    const { createClient } = require("@supabase/supabase-js");
    const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await tempClient.auth.signInWithPassword({ email, password });
    if (signInError) {
      return res.status(401).json({ success: false, error: "Incorrect password" });
    }

    // Generate new TOTP secret
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: "SmartClearance",
      label: email,
      secret,
      type: "totp",
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store the new secret temporarily — do NOT overwrite the profile yet.
    // The old secret stays active until the user verifies the new one.
    await setToken(userId, TOKEN_TYPES.TOTP_RESET, {
      tokenValue: secret,
      expiresInMs: 10 * 60 * 1000, // 10 minutes to complete the reset
    });

    res.json({ success: true, qrCode: qrCodeDataUrl, manualKey: secret });
  } catch (error) {
    console.error("2FA reset-setup error:", error);
    res.status(500).json({ success: false, error: "Failed to reset authenticator" });
  }
});

// ── Verify Reset: confirm the new authenticator is working ──
router.post("/verify-reset", requireAuth, requireMatchingUserId, verifyTotpLimiter, async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ success: false, error: "User ID and token are required" });
    }

    // Get the pending reset secret from the token store
    const pending = await getToken(userId, TOKEN_TYPES.TOTP_RESET);
    if (!pending || !pending.tokenValue) {
      return res.status(400).json({ success: false, error: "No pending reset found. Please start the reset process again." });
    }

    const result = verifySync({ token: token.toString(), secret: pending.tokenValue, epochTolerance: 30 });

    if (!result || !result.valid) {
      return res.status(400).json({ success: false, error: "Invalid code. Please try again." });
    }

    // Verification passed — now commit the new secret to the profile
    const { error } = await supabase
      .from("profiles")
      .update({ totp_secret: pending.tokenValue })
      .eq("id", userId);

    if (error) {
      return res.status(500).json({ success: false, error: "Failed to save new authenticator" });
    }

    // Cleanup the temporary token
    await deleteToken(userId, TOKEN_TYPES.TOTP_RESET);

    res.json({ success: true, message: "Authenticator reset successfully" });
  } catch (error) {
    console.error("2FA verify-reset error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

router.post("/status", requireAuth, requireMatchingUserId, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required" });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("totp_enabled")
      .eq("id", userId)
      .single();

    if (error) {
      return res.json({ success: true, totpEnabled: false });
    }

    res.json({ success: true, totpEnabled: profile?.totp_enabled || false });
  } catch (error) {
    console.error("2FA status error:", error);
    res.json({ success: true, totpEnabled: false });
  }
});

module.exports = router;
