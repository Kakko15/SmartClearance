function errorHandler(err, req, res, _next) {
  console.error(`[${req.method} ${req.originalUrl}]`, err.message || err);

  if (err.message === "Not allowed by CORS") {
    return res
      .status(403)
      .json({ success: false, error: "CORS: origin not allowed" });
  }

  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(status).json({ success: false, error: message });
}

module.exports = errorHandler;
