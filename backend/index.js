require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const requestRoutes = require("./routes/requestRoutes");
const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");
const commentRoutes = require("./routes/commentRoutes");
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
app.use("/api/clearance", commentRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/escalation", escalationRoutes);
app.use("/api/graduation", graduationRoutes);
app.use("/api/admin", adminAccountRoutes);

app.get("/", (req, res) => {
  res.send("Smart Clearance System backend running!");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
