const express = require("express");
const router = express.Router();
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const supabase = require("../supabaseClient");
const twoFactorRoutes = require("./twoFactorRoutes");
const { validatePassword } = require("../utils/validatePassword");

const { TOKEN_TYPES, setToken, getToken, incrementAttempts, deleteToken } = require("../services/otpStore");

const EMAIL_VERIFY_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_VERIFY_COOLDOWN_MS = 60 * 1000; // 60 seconds between resends
const EMAIL_VERIFY_MAX_ATTEMPTS = 5;

// B9 FIX: Singleton transporter — reuse SMTP connection across all emails.
// Lazy-initialized on first use so env vars are available.
let _emailTransporter = null;
function getEmailTransporter() {
  if (!_emailTransporter) {
    _emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
  return _emailTransporter;
}

const isDev = process.env.NODE_ENV !== "production";
const DEFAULT_LOGIN_WINDOW_MINUTES = 15;
const DEFAULT_LOGIN_ACCOUNT_MAX = isDev ? 15 : 5;
const DEFAULT_LOGIN_IP_MAX = isDev ? 60 : 25;

function getEnvInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getIpKey(req) {
  return rateLimit.ipKeyGenerator(
    req.ip || req.socket?.remoteAddress || "unknown",
  );
}

const LOGIN_WINDOW_MINUTES = getEnvInt(
  "LOGIN_RATE_LIMIT_WINDOW_MINUTES",
  DEFAULT_LOGIN_WINDOW_MINUTES,
);
const LOGIN_WINDOW_MS = LOGIN_WINDOW_MINUTES * 60 * 1000;
const LOGIN_ACCOUNT_MAX = getEnvInt(
  "LOGIN_RATE_LIMIT_ACCOUNT_MAX",
  DEFAULT_LOGIN_ACCOUNT_MAX,
);
const LOGIN_IP_MAX = getEnvInt("LOGIN_RATE_LIMIT_IP_MAX", DEFAULT_LOGIN_IP_MAX);
const LOGIN_ACCOUNT_LIMIT_ERROR =
  `Too many failed sign-in attempts for this account. Please try again in ${LOGIN_WINDOW_MINUTES} minutes or reset your password.`;
const LOGIN_IP_LIMIT_ERROR =
  `Too many login attempts from this network. Please try again in ${LOGIN_WINDOW_MINUTES} minutes.`;

function getResetInSeconds(resetTime) {
  if (!resetTime) return null;

  const resetAt =
    resetTime instanceof Date
      ? resetTime.getTime()
      : new Date(resetTime).getTime();

  if (Number.isNaN(resetAt)) return null;

  return Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
}

function createRateLimitPayload(rateLimit, fallbackLimit, scope, blocked = false) {
  return {
    scope,
    limit: Number.isFinite(rateLimit?.limit) ? rateLimit.limit : fallbackLimit,
    remaining: Math.max(
      0,
      Number.isFinite(rateLimit?.remaining) ? rateLimit.remaining : 0,
    ),
    resetInSeconds: getResetInSeconds(rateLimit?.resetTime),
    blocked,
  };
}

function getMostRestrictiveRateLimit(req) {
  const candidates = [
    createRateLimitPayload(
      req.loginAccountRateLimit,
      LOGIN_ACCOUNT_MAX,
      "account",
    ),
    createRateLimitPayload(req.loginIpRateLimit, LOGIN_IP_MAX, "ip"),
  ];

  return candidates.reduce((selected, candidate) => {
    if (!selected) return candidate;
    if (candidate.remaining !== selected.remaining) {
      return candidate.remaining < selected.remaining ? candidate : selected;
    }

    const selectedReset = selected.resetInSeconds ?? Number.MAX_SAFE_INTEGER;
    const candidateReset = candidate.resetInSeconds ?? Number.MAX_SAFE_INTEGER;
    return candidateReset < selectedReset ? candidate : selected;
  }, null);
}

function captureRateLimit(propertyName, limiter) {
  return (req, res, next) => {
    limiter(req, res, (err) => {
      if (req.rateLimit) {
        req[propertyName] = req.rateLimit;
      }
      next(err);
    });
  };
}

function createLoginLimiterHandler(scope, fallbackLimit, errorMessage) {
  return (req, res, _next, options) => {
    return res.status(options.statusCode).json({
      success: false,
      error: errorMessage,
      rateLimit: createRateLimitPayload(req.rateLimit, fallbackLimit, scope, true),
    });
  };
}

const loginIpLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_IP_MAX,
  keyGenerator: (req) => getIpKey(req),
  handler: createLoginLimiterHandler("ip", LOGIN_IP_MAX, LOGIN_IP_LIMIT_ERROR),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const loginAccountLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_ACCOUNT_MAX,
  keyGenerator: (req) => {
    const email = normalizeEmail(req.body?.email) || "anonymous";
    return `${getIpKey(req)}:${email}`;
  },
  handler: createLoginLimiterHandler(
    "account",
    LOGIN_ACCOUNT_MAX,
    LOGIN_ACCOUNT_LIMIT_ERROR,
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 100 : 5,
  message: {
    success: false,
    error: "Too many signup attempts from this IP. Please try again in an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

async function verifyRecaptcha(token) {
  try {
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token,
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return { success: false, "error-codes": ["network-error"] };
  }
}

router.post(
  "/login",
  captureRateLimit("loginIpRateLimit", loginIpLimiter),
  captureRateLimit("loginAccountRateLimit", loginAccountLimiter),
  async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
        rateLimit: getMostRestrictiveRateLimit(req),
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({
        success: false,
        error: error.message,
        rateLimit: getMostRestrictiveRateLimit(req),
      });
    }

    // Check if email is verified
    const user = data.user;
    if (!user.email_confirmed_at) {
      return res.status(403).json({
        success: false,
        error: "Please verify your email before signing in. Check your inbox for the verification code.",
        emailNotVerified: true,
        userId: user.id,
        email: user.email,
      });
    }

    res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "An error occurred during login. Please try again." });
  }
});

const checkEmailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 10,
  message: { success: false, error: "Too many requests. Please wait." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/check-email", checkEmailLimiter, async (req, res) => {
  const start = Date.now();
  // Constant-time floor: every response takes at least this many ms,
  // preventing timing-based email enumeration.
  const MIN_RESPONSE_MS = 200;

  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    // O(1) lookup via Postgres function on auth.users (indexed by email).
    // Requires migration: backend/migrations/add_check_email_function.sql
    const { data, error } = await supabase
      .rpc("check_email_exists", { email_input: email });

    if (error) {
      console.error("check_email_exists RPC error:", error.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }

    const exists = !!data;

    // Pad response time to a constant floor so "exists" vs "not exists"
    // can't be distinguished by network timing.
    const elapsed = Date.now() - start;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
    }

    return res.json({ success: true, exists });
  } catch (error) {
    console.error("Check email error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

router.post("/signup", signupLimiter, async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      studentNumber,
      courseYear,
      recaptchaToken,
      adminSecretCode,
    } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const adminRoles = [
      "signatory",
      "librarian",
      "cashier",
      "registrar",
      "super_admin",
    ];

    if (!adminRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error:
          "Student accounts must be created by administration. Please contact your admin office.",
      });
    }

    if (!adminSecretCode || adminSecretCode.trim().length < 8) {
      return res.status(400).json({
        success: false,
        error: "Valid admin secret code is required",
      });
    }

    const { data: codeData, error: codeError } = await supabase
      .from("admin_secret_codes")
      .select("*")
      .eq("code", adminSecretCode)
      .eq("role", role)
      .eq("is_active", true)
      .single();

    if (codeError || !codeData) {
      return res.status(403).json({
        success: false,
        error: "Invalid or expired admin secret code",
      });
    }

    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      return res.status(403).json({
        success: false,
        error: "Admin secret code has expired",
      });
    }

    if (codeData.current_uses >= codeData.max_uses) {
      return res.status(403).json({
        success: false,
        error: "Admin secret code has reached maximum uses",
      });
    }

    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken);
      if (!recaptchaResult.success) {
        return res.status(400).json({
          success: false,
          error: "reCAPTCHA verification failed. Please try again.",
        });
      }
    } else if (!isDev) {
      return res.status(400).json({
        success: false,
        error: "reCAPTCHA verification is required.",
      });
    }

    if (firstName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "First name must be at least 2 characters",
      });
    }

    if (lastName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "Last name must be at least 2 characters",
      });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ success: false, error: pwCheck.error });
    }

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });

    if (authError) {
      console.error("Auth creation error:", authError);
      return res.status(400).json({
        success: false,
        error: authError.message,
      });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        full_name: fullName,
        role: role,
        student_number: null,
        course_year: null,
        account_enabled: true,
      })
      .select()
      .single();

    if (profileError) {
      console.error("Profile creation error:", profileError);

      await supabase.auth.admin.deleteUser(authData.user.id);

      return res.status(400).json({
        success: false,
        error: "Failed to create user profile",
      });
    }

    await supabase
      .from("admin_secret_codes")
      .update({
        current_uses: codeData.current_uses + 1,
        used_by: authData.user.id,
        used_at: new Date().toISOString(),
      })
      .eq("id", codeData.id);

    try {
      await supabase.from("auth_audit_log").insert({
        user_id: authData.user.id,
        action: "admin_signup",
        success: true,
        metadata: {
          role: role,
          secret_code_used: codeData.id,
        },
      });
    } catch (logError) {
      console.warn(
        "Auth audit log insert failed (table may not exist):",
        logError.message,
      );
    }

    // Send email verification code
    await sendVerificationEmail(authData.user.id, email);

    // Generate a short-lived signup token for 2FA setup authentication
    const signupToken = await twoFactorRoutes.generateSignupToken(authData.user.id);

    res.json({
      success: true,
      message: "Account created successfully! Please verify your email.",
      emailVerificationRequired: true,
      signupToken,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        fullName: fullName,
        role: role,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred during signup. Please try again.",
    });
  }
});

router.post("/verify-recaptcha", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "reCAPTCHA token is required",
      });
    }

    const result = await verifyRecaptcha(token);

    res.json({
      success: result.success,
      message: result.success
        ? "reCAPTCHA verified"
        : "reCAPTCHA verification failed",
      errorCodes: result["error-codes"],
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({
      success: false,
      error: "Verification failed",
    });
  }
});

router.post("/signup-student", signupLimiter, async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      studentNumber,
      courseYear,
      recaptchaToken,
      faceVerification,
    } = req.body;

    if (
      !email ||
      !password ||
      !firstName ||
      !lastName ||
      !studentNumber ||
      !courseYear
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (
      !faceVerification ||
      typeof faceVerification.verified !== "boolean" ||
      typeof faceVerification.similarity !== "number"
    ) {
      return res.status(400).json({
        success: false,
        error: "Face verification data is required",
      });
    }

    if (recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken);
      if (!recaptchaResult.success) {
        return res.status(400).json({
          success: false,
          error: "reCAPTCHA verification failed. Please try again.",
        });
      }
    } else if (!isDev) {
      return res.status(400).json({
        success: false,
        error: "reCAPTCHA verification is required.",
      });
    }

    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "Name must be at least 2 characters",
      });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ success: false, error: pwCheck.error });
    }

    const similarity = faceVerification.similarity;
    const isAutoApproved = faceVerification.verified && similarity >= 90;

    let verificationStatus = "pending_review";
    let accountEnabled = false;

    if (isAutoApproved) {
      verificationStatus = "auto_approved";
      accountEnabled = true;
    }

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });

    if (authError) {
      console.error("Auth creation error:", authError);
      return res.status(400).json({
        success: false,
        error: authError.message,
      });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        full_name: fullName,
        role: "student",
        student_number: studentNumber.trim().toUpperCase(),
        course_year: courseYear,
        face_verified: faceVerification.verified,
        face_similarity: similarity,
        verification_status: verificationStatus,
        account_enabled: accountEnabled,
      })
      .select()
      .single();

    if (profileError) {
      console.error("Profile creation error:", profileError);
      await supabase.auth.admin.deleteUser(authData.user.id);

      let errorMessage =
        profileError.message || "Failed to create user profile";
      if (profileError.code === "23505") {
        if (profileError.details?.includes("student_number")) {
          errorMessage =
            "This student number is already registered. Please use a different one or contact the registrar.";
        } else if (profileError.details?.includes("email")) {
          errorMessage =
            "This email is already registered. Please use a different email or sign in.";
        } else {
          errorMessage = "An account with these details already exists.";
        }
      }

      return res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }

    try {
      await supabase.from("auth_audit_log").insert({
        user_id: authData.user.id,
        action: "student_signup_with_face_verification",
        success: true,
        metadata: {
          face_verified: faceVerification.verified,
          face_similarity: similarity,
          auto_approved: isAutoApproved,
          verification_status: verificationStatus,
        },
      });
    } catch (logError) {
      console.warn(
        "Auth audit log insert failed (table may not exist):",
        logError.message,
      );
    }

    // Send email verification code
    await sendVerificationEmail(authData.user.id, email);

    // Generate a short-lived signup token for 2FA setup authentication
    const signupToken = await twoFactorRoutes.generateSignupToken(authData.user.id);

    res.json({
      success: true,
      autoApproved: isAutoApproved,
      similarity: similarity,
      emailVerificationRequired: true,
      signupToken,
      message: isAutoApproved
        ? "Account approved! Please verify your email."
        : "Account pending review. Please verify your email.",
      user: {
        id: authData.user.id,
        email: authData.user.email,
        fullName: fullName,
        role: "student",
        verificationStatus: verificationStatus,
      },
    });
  } catch (error) {
    console.error("Student signup error:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred during signup. Please try again.",
    });
  }
});

// ── Email Verification ──────────────────────────────────────────────────────

async function sendVerificationEmail(userId, email) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await setToken(userId, TOKEN_TYPES.EMAIL_VERIFY, {
    tokenValue: otp,
    email,
    expiresInMs: EMAIL_VERIFY_EXPIRY_MS,
    maxAttempts: EMAIL_VERIFY_MAX_ATTEMPTS,
  });

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify Your Email - SmartClearance",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #22c55e; margin: 0;">SmartClearance</h1>
        </div>
        <h2 style="color: #1f2937;">Verify Your Email Address</h2>
        <p style="color: #4b5563; font-size: 16px;">
          Use the code below to verify your email and activate your account:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background: #f3f4f6; border-radius: 12px; padding: 20px 40px; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #1f2937; border: 2px solid #e5e7eb;">
            ${otp}
          </div>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This code expires in 10 minutes. If you didn't create an account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          SmartClearance - Isabela State University
        </p>
      </div>
    `,
  });
}

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 30 : 10,
  message: { success: false, error: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const sendVerifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 20 : 5,
  message: { success: false, error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/send-verification-email", sendVerifyEmailLimiter, async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ success: false, error: "User ID and email are required" });
    }

    // Enforce cooldown
    const existing = await getToken(userId, TOKEN_TYPES.EMAIL_VERIFY);
    if (existing && (Date.now() - existing.createdAt) < EMAIL_VERIFY_COOLDOWN_MS) {
      const waitSec = Math.ceil((EMAIL_VERIFY_COOLDOWN_MS - (Date.now() - existing.createdAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSec} seconds before requesting a new code.`,
      });
    }

    // Verify the user actually exists and email matches
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !user || user.email?.toLowerCase() !== email.trim().toLowerCase()) {
      return res.status(400).json({ success: false, error: "Invalid request" });
    }

    // Already verified
    if (user.email_confirmed_at) {
      return res.json({ success: true, alreadyVerified: true, message: "Email is already verified. You can sign in." });
    }

    await sendVerificationEmail(userId, email);
    res.json({ success: true, message: "Verification code sent" });
  } catch (error) {
    console.error("Send verification email error:", error);
    res.status(500).json({ success: false, error: "Failed to send verification email" });
  }
});

router.post("/verify-email", verifyEmailLimiter, async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ success: false, error: "User ID and code are required" });
    }

    const stored = await getToken(userId, TOKEN_TYPES.EMAIL_VERIFY);
    if (!stored) {
      return res.status(400).json({ success: false, error: "No verification code found. Please request a new one." });
    }

    if (Date.now() > stored.expiresAt) {
      await deleteToken(userId, TOKEN_TYPES.EMAIL_VERIFY);
      return res.status(400).json({ success: false, error: "Code expired. Please request a new one." });
    }

    if (stored.attempts >= EMAIL_VERIFY_MAX_ATTEMPTS) {
      await deleteToken(userId, TOKEN_TYPES.EMAIL_VERIFY);
      return res.status(429).json({ success: false, error: "Too many failed attempts. Please request a new code." });
    }

    if (stored.tokenValue !== code.toString().trim()) {
      const newAttempts = await incrementAttempts(userId, TOKEN_TYPES.EMAIL_VERIFY);
      const remaining = EMAIL_VERIFY_MAX_ATTEMPTS - newAttempts;
      if (remaining <= 0) {
        await deleteToken(userId, TOKEN_TYPES.EMAIL_VERIFY);
      }
      return res.status(400).json({
        success: false,
        error: `Invalid code. ${Math.max(remaining, 0)} attempt${remaining === 1 ? "" : "s"} remaining.`,
      });
    }

    // Code is correct — confirm the email in Supabase
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (updateError) {
      console.error("Email confirm error:", updateError);
      return res.status(500).json({ success: false, error: "Failed to verify email. Please try again." });
    }

    await deleteToken(userId, TOKEN_TYPES.EMAIL_VERIFY);

    // Audit log
    try {
      await supabase.from("auth_audit_log").insert({
        user_id: userId,
        action: "email_verified",
        success: true,
        metadata: { email: stored.email || email },
      });
    } catch (logError) {
      console.warn("Auth audit log insert failed:", logError.message);
    }

    res.json({ success: true, message: "Email verified successfully! You can now sign in." });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

// ── Forgot Password ─────────────────────────────────────────────────────────

router.post("/forgot-password", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${req.headers.origin || "http://localhost:5173"}/reset-password`,
      },
    });

    if (error) {
      return res.json({ success: true, message: "If an account exists, a reset link has been sent." });
    }

    const resetLink = data?.properties?.action_link;
    if (!resetLink) {
      return res.json({ success: true, message: "If an account exists, a reset link has been sent." });
    }

    const transporter = getEmailTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Reset Your Password - SmartClearance",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22c55e; margin: 0;">SmartClearance</h1>
          </div>
          <h2 style="color: #1f2937;">Reset Your Password</h2>
          <p style="color: #4b5563; font-size: 16px;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #22c55e; color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't request this, you can safely ignore this email. This link will expire in 24 hours.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            SmartClearance - Isabela State University
          </p>
        </div>
      `,
    });

    res.json({ success: true, message: "Password reset link sent to your email." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.json({ success: true, message: "If an account exists, a reset link has been sent." });
  }
});

module.exports = router;
