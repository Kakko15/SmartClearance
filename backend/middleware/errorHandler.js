const { sanitizeErrorMessage } = require("../utils/safeError");

function errorHandler(err, req, res, _next) {
  console.error(`[${req.method} ${req.originalUrl}]`, err.message || err);

  if (err.message === "Not allowed by CORS") {
    return res
      .status(403)
      .json({ success: false, error: "CORS: origin not allowed" });
  }

  if (err.name === "MulterError") {
    const multerMessages = {
      LIMIT_FILE_SIZE: "File too large",
      LIMIT_FILE_COUNT: "Too many files",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field",
    };
    return res.status(400).json({
      success: false,
      error: multerMessages[err.code] || "File upload error",
    });
  }

  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? sanitizeErrorMessage(err)
      : err.message || "Internal server error";

  res.status(status).json({ success: false, error: message });
}

module.exports = errorHandler;
