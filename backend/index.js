const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const app = express();

const { allowedOrigins } = require("./constants/allowedOrigins");

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
app.use(express.json({ limit: "10mb" }));

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

const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

app.get("/", (req, res) => {
  res.send("Smart Clearance System backend running!");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const { cleanupExpired } = require("./services/otpStore");
setInterval(() => cleanupExpired().catch(() => {}), 15 * 60 * 1000);

const {
  cleanupUnverifiedAccounts,
} = require("./services/unverifiedAccountCleanup");
setTimeout(() => cleanupUnverifiedAccounts().catch(() => {}), 60 * 1000);
setInterval(
  () => cleanupUnverifiedAccounts().catch(() => {}),
  6 * 60 * 60 * 1000,
);

const { checkDeadlineReminders } = require("./services/notificationService");

setTimeout(() => checkDeadlineReminders().catch(() => {}), 30 * 1000);
setInterval(
  () => checkDeadlineReminders().catch(() => {}),
  24 * 60 * 60 * 1000,
);
