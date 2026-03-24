const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const app = express();

const { allowedOrigins } = require("./constants/allowedOrigins");

// L-7: Security headers
app.use(helmet());

// L-8: HTTP request logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// L-9: Reduced from 10MB to 1MB to prevent abuse
app.use(express.json({ limit: "1mb" }));

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
const analyticsRoutes = require("./routes/analyticsRoutes");
const profileRoutes = require("./routes/profileRoutes");
const delegationRoutes = require("./routes/delegationRoutes");
app.use("/api/requests", requestRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auth/2fa", twoFactorRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/comments", commentRoutes);

app.use("/api/clearance", clearanceRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/escalation", escalationRoutes);
app.use("/api/graduation", graduationRoutes);
app.use("/api/admin", adminAccountRoutes);
app.use("/api/admin/secret-codes", secretCodeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/delegation", delegationRoutes);

app.get("/", (req, res) => {
  res.send("Smart Clearance System backend running!");
});

const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const cron = require("node-cron");
const { cleanupExpired } = require("./services/otpStore");
const {
  cleanupUnverifiedAccounts,
} = require("./services/unverifiedAccountCleanup");
const { checkDeadlineReminders } = require("./services/notificationService");

const scheduledTasks = [];

scheduledTasks.push(
  cron.schedule("*/15 * * * *", async () => {
    try {
      await cleanupExpired();
    } catch (err) {
      console.error("[Cron] OTP cleanup failed:", err.message);
    }
  }),
);

if (process.env.NODE_ENV === "production") {
  scheduledTasks.push(
    cron.schedule("0 */6 * * *", async () => {
      try {
        console.log("[Cron] Running unverified account cleanup...");
        await cleanupUnverifiedAccounts();
        console.log("[Cron] Unverified account cleanup complete.");
      } catch (err) {
        console.error("[Cron] Unverified account cleanup failed:", err.message);
      }
    }),
  );

  scheduledTasks.push(
    cron.schedule("0 8 * * *", async () => {
      try {
        console.log("[Cron] Running deadline reminders...");
        await checkDeadlineReminders();
        console.log("[Cron] Deadline reminders complete.");
      } catch (err) {
        console.error("[Cron] Deadline reminders failed:", err.message);
      }
    }),
  );

  // Run once on startup after 30s warm-up
  setTimeout(() => {
    cleanupUnverifiedAccounts().catch(() => {});
    checkDeadlineReminders().catch(() => {});
  }, 30 * 1000);
}

// L-10: Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    console.log("[Shutdown] HTTP server closed.");
    process.exit(0);
  });

  // Stop all scheduled cron tasks
  for (const task of scheduledTasks) {
    task.stop();
  }
  console.log(`[Shutdown] ${scheduledTasks.length} cron task(s) stopped.`);

  // Force exit after 10s if connections are still hanging
  setTimeout(() => {
    console.error("[Shutdown] Forcing exit after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

