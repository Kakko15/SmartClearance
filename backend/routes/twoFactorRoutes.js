const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { generateSecret, verifySync, generateURI } = require("otplib");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const supabase = require("../supabaseClient");

const isDev = process.env.NODE_ENV !== "production";

const OTP_EXPIRY_MS = 3 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_MS = 60 * 1000;

const emailOTPs = new Map();

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

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

router.post("/setup", async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ success: false, error: "User ID and email are required" });
    }

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
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ success: false, error: "User ID and token are required" });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("totp_secret")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.totp_secret) {
      return res.status(400).json({ success: false, error: "2FA not initialized. Please restart setup." });
    }

    const isValid = verifySync({ token: token.toString(), secret: profile.totp_secret });

    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid code. Please check your authenticator app and try again." });
    }

    await supabase
      .from("profiles")
      .update({ totp_enabled: true })
      .eq("id", userId);

    res.json({ success: true, message: "2FA enabled successfully" });
  } catch (error) {
    console.error("2FA verify-setup error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

router.post("/verify-totp", async (req, res) => {
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

    const isValid = verifySync({ token: token.toString(), secret: profile.totp_secret });

    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid code. Please try again." });
    }

    res.json({ success: true, message: "2FA verified" });
  } catch (error) {
    console.error("2FA verify-totp error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

router.post("/send-email-otp", sendOtpLimiter, async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ success: false, error: "User ID and email are required" });
    }

    const existing = emailOTPs.get(userId);
    if (existing && (Date.now() - existing.createdAt) < OTP_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - existing.createdAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSec} seconds before requesting a new code.`,
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();

    emailOTPs.set(userId, { otp, expiresAt: now + OTP_EXPIRY_MS, createdAt: now, attempts: 0 });

    const expiryMinutes = Math.round(OTP_EXPIRY_MS / 60000);

    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Your Login Verification Code - SmartClearance",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22c55e; margin: 0;">SmartClearance</h1>
          </div>
          <h2 style="color: #1f2937;">Your Verification Code</h2>
          <p style="color: #4b5563; font-size: 16px;">
            Use the code below to complete your login:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background: #f3f4f6; border-radius: 12px; padding: 20px 40px; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #1f2937; border: 2px solid #e5e7eb;">
              ${otp}
            </div>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This code expires in <strong>${expiryMinutes} minutes</strong>. If you didn't request this, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            SmartClearance - Isabela State University
          </p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: "Verification code sent to your email",
      expiresIn: OTP_EXPIRY_MS,
    });
  } catch (error) {
    console.error("Send email OTP error:", error);
    res.status(500).json({ success: false, error: "Failed to send verification code" });
  }
});

router.post("/verify-email-otp", verifyOtpLimiter, async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ success: false, error: "User ID and OTP are required" });
    }

    const stored = emailOTPs.get(userId);

    if (!stored) {
      return res.status(400).json({ success: false, error: "No verification code found. Please request a new one." });
    }

    if (Date.now() > stored.expiresAt) {
      emailOTPs.delete(userId);
      return res.status(400).json({ success: false, error: "Code expired. Please request a new one." });
    }

    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      emailOTPs.delete(userId);
      return res.status(429).json({ success: false, error: "Too many failed attempts. Please request a new code." });
    }

    if (stored.otp !== otp.toString()) {
      stored.attempts += 1;
      const remaining = OTP_MAX_ATTEMPTS - stored.attempts;
      const msg = remaining > 0
        ? `Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
        : "Too many failed attempts. Please request a new code.";
      if (remaining <= 0) emailOTPs.delete(userId);
      return res.status(400).json({ success: false, error: msg });
    }

    emailOTPs.delete(userId);
    res.json({ success: true, message: "2FA verified" });
  } catch (error) {
    console.error("Verify email OTP error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

router.post("/status", async (req, res) => {
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
