const SAFE_GENERIC_MESSAGE = "An unexpected error occurred. Please try again.";

const INTERNAL_PATTERNS = [
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /duplicate key value/i,
  /violates (foreign key|unique|check) constraint/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /supabase/i,
  /schema/i,
  /\.env/i,
  /password authentication failed/i,
  /connection refused/i,
  /ENOTFOUND/i,
];

function sanitizeErrorMessage(error) {
  const message =
    typeof error === "string" ? error : error?.message || SAFE_GENERIC_MESSAGE;

  if (INTERNAL_PATTERNS.some((pattern) => pattern.test(message))) {
    return SAFE_GENERIC_MESSAGE;
  }

  return message;
}

function safeErrorResponse(res, error, statusCode = 500) {
  const isDev = process.env.NODE_ENV !== "production";
  const rawMessage = error?.message || "Unknown error";

  if (isDev) {
    return res
      .status(statusCode)
      .json({ success: false, error: rawMessage });
  }

  return res
    .status(statusCode)
    .json({ success: false, error: sanitizeErrorMessage(rawMessage) });
}

module.exports = { sanitizeErrorMessage, safeErrorResponse, SAFE_GENERIC_MESSAGE };
