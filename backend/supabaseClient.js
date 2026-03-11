const { createClient } = require("@supabase/supabase-js");

// BUG 2 FIX: Use SUPABASE_SERVICE_KEY (admin privileges) instead of
// SUPABASE_KEY (anon/RLS-restricted). This shared client is used by
// server-side services (escalation, certificates, notifications) that
// need to bypass Row Level Security.
//
// The auth options disable token refresh and session persistence since
// this is a server-side client that uses the service_role key directly.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

module.exports = supabase;
