-- Migration: Create check_email_exists RPC function
-- This replaces the old while-loop pagination approach with an O(1) index lookup.
-- Must be run by a superuser / service_role since it accesses auth.users.

CREATE OR REPLACE FUNCTION public.check_email_exists(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = lower(trim(email_input))
  );
$$;

-- Only the service_role (backend) should call this — revoke from public/anon
REVOKE ALL ON FUNCTION public.check_email_exists(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_email_exists(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.check_email_exists(TEXT) FROM authenticated;

-- Grant to service_role only
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO service_role;
