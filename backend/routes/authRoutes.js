const express = require("express");
const router = express.Router();
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

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
      "professor",
      "library_admin",
      "cashier_admin",
      "registrar_admin",
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
        console.warn(
          "[WARN] reCAPTCHA verification failed:",
          recaptchaResult["error-codes"],
        );
      }
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

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters",
      });
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        success: false,
        error:
          "Password must contain uppercase, lowercase, number, and special character",
      });
    }

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
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

    res.json({
      success: true,
      message: "Admin account created successfully! You can now sign in.",
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
        console.warn("[WARN] reCAPTCHA verification failed:", recaptchaResult["error-codes"]);
      }
    }

    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "Name must be at least 2 characters",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters",
      });
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        success: false,
        error:
          "Password must contain uppercase, lowercase, number, and special character",
      });
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
        email_confirm: true,
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
        student_number: studentNumber.trim(),
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

    res.json({
      success: true,
      autoApproved: isAutoApproved,
      similarity: similarity,
      message: isAutoApproved
        ? "Account approved! You can login now."
        : "Account pending review. Admin will verify manually.",
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

    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

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
