-- Fix: admin_secret_codes constraint failed because some rows still have old role names
-- Run this in Supabase SQL editor

-- 1. See what roles currently exist in the table (for debugging)
-- SELECT DISTINCT role FROM admin_secret_codes;

-- 2. Drop the old constraint if it exists
ALTER TABLE admin_secret_codes DROP CONSTRAINT IF EXISTS admin_secret_codes_role_check;

-- 3. Rename any remaining old role values
UPDATE admin_secret_codes SET role = 'librarian'  WHERE role = 'library_admin';
UPDATE admin_secret_codes SET role = 'cashier'    WHERE role = 'cashier_admin';
UPDATE admin_secret_codes SET role = 'registrar'  WHERE role = 'registrar_admin';
UPDATE admin_secret_codes SET role = 'signatory'  WHERE role = 'professor';

-- 4. Delete any rows with roles that shouldn't exist (e.g. super_admin codes)
DELETE FROM admin_secret_codes WHERE role NOT IN ('librarian', 'cashier', 'registrar', 'signatory');

-- 5. Now add the new constraint
ALTER TABLE admin_secret_codes ADD CONSTRAINT admin_secret_codes_role_check
  CHECK (role IN ('librarian', 'cashier', 'registrar', 'signatory'));
