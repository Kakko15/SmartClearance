-- Migration: Persistent OTP/Token Storage
-- Replaces in-memory Maps with a Supabase table for OTPs and signup tokens.
-- This ensures tokens survive server restarts and work with horizontal scaling.

CREATE TABLE IF NOT EXISTS otp_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('email_verify', 'email_otp', 'signup_token')),
  token_value TEXT NOT NULL,
  email TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  setup_used BOOLEAN DEFAULT FALSE,
  UNIQUE (user_id, token_type)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_otp_tokens_user_type ON otp_tokens (user_id, token_type);

-- Auto-cleanup expired tokens (run periodically or use pg_cron)
-- DELETE FROM otp_tokens WHERE expires_at < NOW();

-- RLS: Only service_role can access this table (backend only)
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service_role key can access (which is what the backend uses)
