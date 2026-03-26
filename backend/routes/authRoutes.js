const express = require("express");
const router = express.Router();
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const supabase = require("../supabaseClient");
const { safeErrorResponse, sanitizeErrorMessage } = require("../utils/safeError");
const { createClient } = require("@supabase/supabase-js");

const loginClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const twoFactorRoutes = require("./twoFactorRoutes");
const { validatePassword } = require("../utils/validatePassword");
const {
  buildGoogleEmail,
  getLogoAttachment,
} = require("../utils/emailTemplate");
const { getEmailTransporter } = require("../utils/emailTransporter");

const crypto = require("crypto");
const {
  TOKEN_TYPES,
  setToken,
  getToken,
  incrementAttempts,
  deleteToken,
} = require("../services/otpStore");

const EMAIL_VERIFY_EXPIRY_MS = 10 * 60 * 1000;
const EMAIL_VERIFY_TOKEN_EXPIRY_MS = 30 * 60 * 1000;

async function generateEmailVerifyToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await setToken(userId, TOKEN_TYPES.EMAIL_VERIFY_TOKEN, {
    tokenValue: token,
    expiresInMs: EMAIL_VERIFY_TOKEN_EXPIRY_MS,
  });
  return token;
}

async function validateEmailVerifyToken(userId, token) {
  const stored = await getToken(userId, TOKEN_TYPES.EMAIL_VERIFY_TOKEN);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    await deleteToken(userId, TOKEN_TYPES.EMAIL_VERIFY_TOKEN);
    return false;
  }
  return stored.tokenValue === token;
}
const EMAIL_VERIFY_COOLDOWN_MS = 60 * 1000;
const EMAIL_VERIFY_MAX_ATTEMPTS = 5;

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmed)) return "";
  return trimmed;
}

function getIpKey(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
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
const LOGIN_ACCOUNT_LIMIT_ERROR = `Too many failed sign-in attempts for this account. Please try again in ${LOGIN_WINDOW_MINUTES} minutes or reset your password.`;
const LOGIN_IP_LIMIT_ERROR = `Too many login attempts from this network. Please try again in ${LOGIN_WINDOW_MINUTES} minutes.`;
const { STUDENT_NUMBER_PATTERN } = require("../constants/validation");

function normalizeStudentNumber(value) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, "");
}

function getResetInSeconds(resetTime) {
  if (!resetTime) return null;

  const resetAt =
    resetTime instanceof Date
      ? resetTime.getTime()
      : new Date(resetTime).getTime();

  if (Number.isNaN(resetAt)) return null;

  return Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
}

function createRateLimitPayload(
  rateLimit,
  fallbackLimit,
  scope,
  blocked = false,
) {
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
      rateLimit: createRateLimitPayload(
        req.rateLimit,
        fallbackLimit,
        scope,
        true,
      ),
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
    error:
      "Too many signup attempts from this IP. Please try again in an hour.",
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


      const { data, error } = await loginClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const isEmailNotConfirmed = error.message
          ?.toLowerCase()
          .includes("email not confirmed");

        if (isEmailNotConfirmed) {
          const { data: emailExists } = await supabase.rpc(
            "check_email_exists",
            { email_input: email },
          );

          if (emailExists) {
            return res.status(403).json({
              success: false,
              error:
                "Please verify your email before signing in. Check your inbox for the verification code.",
              emailNotVerified: true,
            });
          }
        }

        return res.status(401).json({
          success: false,
          error: sanitizeErrorMessage(error),
          rateLimit: getMostRestrictiveRateLimit(req),
        });
      }

      const user = data.user;
      if (!user.email_confirmed_at) {
        const verifyToken = await generateEmailVerifyToken(user.id);

        return res.status(403).json({
          success: false,
          error:
            "Please verify your email before signing in. Check your inbox for the verification code.",
          emailNotVerified: true,
          userId: user.id,
          email: user.email,
          verifyToken,
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
      res
        .status(500)
        .json({
          success: false,
          error: "An error occurred during login. Please try again.",
        });
    }
  },
);

const checkEmailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 100 : 10,
  message: { success: false, error: "Too many requests. Please wait." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/check-email", checkEmailLimiter, async (req, res) => {
  const start = Date.now();

  const MIN_RESPONSE_MS = 200;

  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: "Email is required" });
    }

    const { data, error } = await supabase.rpc("check_email_exists", {
      email_input: email,
    });

    if (error) {
      console.error("check_email_exists RPC error:", error.message);
      return res.status(500).json({ success: false, error: "Server error" });
    }

    const exists = !!data;

    const elapsed = Date.now() - start;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
    }

    if (exists) {
      return res.json({
        success: true,
        message: "This email is already registered.",
      });
    }
    return res.json({ success: true });
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
      designation,
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
    ];

    if (!adminRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error:
          "This signup form is for personnel accounts only. Students should use the Student Portal to sign up.",
      });
    }

    const VALID_DESIGNATIONS = [
      "Department Chairman",
      "College Dean",
      "Director of Student Affairs",
      "NSTP Director",
      "Executive Officer",
      "Dean of Graduate School",
    ];

    if (role === "signatory" && designation && !VALID_DESIGNATIONS.includes(designation)) {
      return res.status(400).json({
        success: false,
        error: "Invalid signatory designation",
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
        ...(role === "signatory" && designation ? { designation } : {}),
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

    supabase
      .from("admin_secret_codes")
      .update({
        current_uses: codeData.current_uses + 1,
        used_by: authData.user.id,
        used_at: new Date().toISOString(),
      })
      .eq("id", codeData.id)
      .eq("current_uses", codeData.current_uses)
      .then(({ data: updateData, error: updateErr }) => {
        if (updateErr) {
          console.warn("Secret code optimistic update failed:", updateErr.message);
        } else if (!updateData || (Array.isArray(updateData) && updateData.length === 0)) {
          console.warn(
            `Secret code ${codeData.id} optimistic lock missed — concurrent use may have occurred.`,
          );
        }
      })
      .catch((err) => console.warn("Secret code update failed:", err.message));

    supabase.from("auth_audit_log").insert({
      user_id: authData.user.id,
      action: "admin_signup",
      success: true,
      metadata: {
        role: role,
        secret_code_used: codeData.id,
      },
    }).then(() => {}).catch((logError) => {
      console.warn(
        "Auth audit log insert failed (table may not exist):",
        logError.message,
      );
    });

    sendVerificationEmail(authData.user.id, email).catch((emailErr) => {
      console.error(
        "Verification email failed (admin signup):",
        emailErr.message,
      );
    });

    const signupToken = await twoFactorRoutes.generateSignupToken(
      authData.user.id,
    );

    res.json({
      success: true,
      message: "Account created successfully! Please verify your email.",
      emailVerificationRequired: true,
      emailSent: true,
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

    if (!recaptchaToken && !isDev) {
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

    const normalizedStudentNumber = normalizeStudentNumber(studentNumber);
    if (!STUDENT_NUMBER_PATTERN.test(normalizedStudentNumber)) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid student number format. Use format: [Year]-[Digits] (e.g., 23-1234 or 23-1234-TS)",
      });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ success: false, error: pwCheck.error });
    }

    const [recaptchaResult, { data: existingProfile }] = await Promise.all([
      recaptchaToken
        ? verifyRecaptcha(recaptchaToken)
        : Promise.resolve({ success: true }),
      supabase
        .from("profiles")
        .select("id, student_number")
        .or(`student_number.eq.${normalizedStudentNumber}`)
        .maybeSingle(),
    ]);

    if (recaptchaToken && !recaptchaResult.success) {
      return res.status(400).json({
        success: false,
        error: "reCAPTCHA verification failed. Please try again.",
      });
    }

    if (existingProfile) {
      return res.status(409).json({
        success: false,
        error:
          "This student number is already registered. If this is your account, please sign in instead. Otherwise, contact the registrar.",
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
        student_number: normalizedStudentNumber,
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

    supabase.from("auth_audit_log").insert({
      user_id: authData.user.id,
      action: "student_signup_with_face_verification",
      success: true,
      metadata: {
        face_verified: faceVerification.verified,
        face_similarity: similarity,
        auto_approved: isAutoApproved,
        verification_status: verificationStatus,
      },
    }).then(() => {}).catch((logError) => {
      console.warn(
        "Auth audit log insert failed (table may not exist):",
        logError.message,
      );
    });

    sendVerificationEmail(authData.user.id, email).catch((emailErr) => {
      console.error(
        "Verification email failed (student signup):",
        emailErr.message,
      );
    });

    const signupToken = await twoFactorRoutes.generateSignupToken(
      authData.user.id,
    );

    res.json({
      success: true,
      autoApproved: isAutoApproved,
      similarity: similarity,
      emailVerificationRequired: true,
      emailSent: true,
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

async function sendVerificationEmail(userId, email) {
  const otp = crypto.randomInt(100000, 1000000).toString();

  await setToken(userId, TOKEN_TYPES.EMAIL_VERIFY, {
    tokenValue: otp,
    email,
    expiresInMs: EMAIL_VERIFY_EXPIRY_MS,
    maxAttempts: EMAIL_VERIFY_MAX_ATTEMPTS,
  });

  const transporter = getEmailTransporter();
  const htmlBody = buildGoogleEmail(
    "Verify Your Email",
    "Verify Your Email Address",
    "Use the code below to verify your email and activate your account:",
    {
      code: otp,
      footerNote:
        "This code expires in 10 minutes. If you didn't create an account, you can safely ignore this email.",
    },
  );

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify Your Email - SmartClearance",
    html: htmlBody,
    attachments: getLogoAttachment(),
  });
}

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 30 : 10,
  message: {
    success: false,
    error: "Too many attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const sendVerifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 20 : 3,
  message: {
    success: false,
    error: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const sendVerifyEmailUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 20 : 3,
  keyGenerator: (req) => req.body?.userId || "unknown",
  message: {
    success: false,
    error: "Too many verification requests for this account.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/send-verification-email",
  sendVerifyEmailLimiter,
  sendVerifyEmailUserLimiter,
  async (req, res) => {
    try {
      const { userId, email, signupToken, verifyToken } = req.body;

      if (!userId || !email) {
        return res
          .status(400)
          .json({ success: false, error: "User ID and email are required" });
      }

      let authorized = false;

      if (signupToken) {
        if (typeof twoFactorRoutes.validateSignupToken === "function") {
          const check = await twoFactorRoutes.validateSignupToken(
            userId,
            signupToken,
          );
          authorized = check.valid;
        }
      }

      if (!authorized && verifyToken) {
        authorized = await validateEmailVerifyToken(userId, verifyToken);
      }

      if (!authorized) {
        return res
          .status(401)
          .json({
            success: false,
            error: "Unauthorized. Please sign up or log in again.",
          });
      }

      const existing = await getToken(userId, TOKEN_TYPES.EMAIL_VERIFY);
      if (
        existing &&
        Date.now() - existing.createdAt < EMAIL_VERIFY_COOLDOWN_MS
      ) {
        const waitSec = Math.ceil(
          (EMAIL_VERIFY_COOLDOWN_MS - (Date.now() - existing.createdAt)) / 1000,
        );
        return res.status(429).json({
          success: false,
          error: `Please wait ${waitSec} seconds before requesting a new code.`,
        });
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.admin.getUserById(userId);
      if (
        error ||
        !user ||
        user.email?.toLowerCase() !== email.trim().toLowerCase()
      ) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid request" });
      }

      if (user.email_confirmed_at) {
        return res.json({
          success: true,
          alreadyVerified: true,
          message: "Email is already verified. You can sign in.",
        });
      }

      await sendVerificationEmail(userId, email);
      res.json({ success: true, message: "Verification code sent" });
    } catch (error) {
      console.error("Send verification email error:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to send verification email" });
    }
  },
);

router.post("/verify-email", verifyEmailLimiter, async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res
        .status(400)
        .json({ success: false, error: "User ID and code are required" });
    }

    const stored = await getToken(userId, TOKEN_TYPES.EMAIL_VERIFY);
    if (!stored) {
      return res
        .status(400)
        .json({
          success: false,
          error: "No verification code found. Please request a new one.",
        });
    }

    if (Date.now() > stored.expiresAt) {
      await deleteToken(userId, TOKEN_TYPES.EMAIL_VERIFY);
      return res
        .status(400)
        .json({
          success: false,
          error: "Code expired. Please request a new one.",
        });
    }

    if (stored.attempts >= EMAIL_VERIFY_MAX_ATTEMPTS) {
      await deleteToken(userId, TOKEN_TYPES.EMAIL_VERIFY);
      return res
        .status(429)
        .json({
          success: false,
          error: "Too many failed attempts. Please request a new code.",
        });
    }

    if (stored.tokenValue !== code.toString().trim()) {
      const newAttempts = await incrementAttempts(
        userId,
        TOKEN_TYPES.EMAIL_VERIFY,
      );
      const remaining = EMAIL_VERIFY_MAX_ATTEMPTS - newAttempts;
      if (remaining <= 0) {
        await deleteToken(userId, TOKEN_TYPES.EMAIL_VERIFY);
      }
      return res.status(400).json({
        success: false,
        error: `Invalid code. ${Math.max(remaining, 0)} attempt${remaining === 1 ? "" : "s"} remaining.`,
      });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        email_confirm: true,
      },
    );

    if (updateError) {
      console.error("Email confirm error:", updateError);
      return res
        .status(500)
        .json({
          success: false,
          error: "Failed to verify email. Please try again.",
        });
    }

    await deleteToken(userId, TOKEN_TYPES.EMAIL_VERIFY);

    try {
      await supabase.from("auth_audit_log").insert({
        user_id: userId,
        action: "email_verified",
        success: true,
        metadata: { email: stored.email || null },
      });
    } catch (logError) {
      console.warn("Auth audit log insert failed:", logError.message);
    }

    res.json({
      success: true,
      message: "Email verified successfully! You can now sign in.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const startTime = Date.now();
  const MIN_DELAY_MS = 300;
  const JITTER_MS = 300;

  const sendResponse = async (response) => {
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, MIN_DELAY_MS + Math.random() * JITTER_MS - elapsed);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    res.json(response);
  };

  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: "Email is required" });
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS?.split(",")[0] || "http://localhost:5173"}/reset-password`,
      },
    });

    if (error) {
      return sendResponse({
        success: true,
        message: "If an account exists, a reset link has been sent.",
      });
    }

    const resetLink = data?.properties?.action_link;
    if (!resetLink) {
      return sendResponse({
        success: true,
        message: "If an account exists, a reset link has been sent.",
      });
    }

    const transporter = getEmailTransporter();

    const htmlBody = buildGoogleEmail(
      "Password Reset",
      "Reset Your Password",
      "We received a request to reset your password. Click the button below to create a new password:",
      {
        button: { text: "Reset Password", url: resetLink },
        footerNote:
          "If you didn't request this, you can safely ignore this email. This link will expire in 24 hours.",
      },
    );

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Reset Your Password - SmartClearance",
      html: htmlBody,
      attachments: getLogoAttachment(),
    });

    return sendResponse({
      success: true,
      message: "Password reset link sent to your email.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, MIN_DELAY_MS + Math.random() * JITTER_MS - elapsed);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    res.json({
      success: true,
      message: "If an account exists, a reset link has been sent.",
    });
  }
});

module.exports = router;
