require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();

const { allowedOrigins } = require("./constants/allowedOrigins");

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

// CSRF protection — validates Origin/Referer on state-changing requests
const csrfProtection = require("./middleware/csrfProtection");
app.use(csrfProtection);

const PORT = process.env.PORT || 5000;

const requestRoutes = require("./routes/requestRoutes");
const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");
const commentRoutes = require("./routes/commentRoutes");
const clearanceRoutes = require("./routes/clearanceRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const escalationRoutes = require("./routes/escalationRoutes");
const graduationRoutes = require("./routes/graduationRoutes");
const adminAccountRoutes = require("./routes/adminAccountRoutes");
const twoFactorRoutes = require("./routes/twoFactorRoutes");
const secretCodeRoutes = require("./routes/secretCodeRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const profileRoutes = require("./routes/profileRoutes");
const delegationRoutes = require("./routes/delegationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

app.use("/api/requests", requestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auth/2fa", twoFactorRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/comments", commentRoutes);
// BUG 1 FIX: /api/clearance now uses its own dedicated router
app.use("/api/clearance", clearanceRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/escalation", escalationRoutes);
app.use("/api/graduation", graduationRoutes);
app.use("/api/admin", adminAccountRoutes);
app.use("/api/admin/secret-codes", secretCodeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/delegation", delegationRoutes);
app.use("/api/analytics", analyticsRoutes);

// Centralized error handler — must be after all routes
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

app.get("/", (req, res) => {
  res.send("Smart Clearance System backend running!");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Cleanup expired OTP tokens every 15 minutes
const { cleanupExpired } = require("./services/otpStore");
setInterval(() => cleanupExpired().catch(() => {}), 15 * 60 * 1000);
