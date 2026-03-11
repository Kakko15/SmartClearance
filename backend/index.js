require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();

// BUG 1 FIX: Restrict CORS to known frontend origins instead of allowing all
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

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
app.use(express.json());

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

app.get("/", (req, res) => {
  res.send("Smart Clearance System backend running!");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
