const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((o) => o.trim());

module.exports = { allowedOrigins };
