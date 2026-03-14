-- Migration: Rename roles to production-ready names
-- Run this AFTER backing up your database.

-- 1. DROP the old CHECK constraint that only allows old role names
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Update profiles table role values
UPDATE profiles SET role = 'librarian'  WHERE role = 'library_admin';
UPDATE profiles SET role = 'cashier'    WHERE role = 'cashier_admin';
UPDATE profiles SET role = 'registrar'  WHERE role = 'registrar_admin';
UPDATE profiles SET role = 'signatory'  WHERE role = 'professor';

-- 3. ADD new CHECK constraint with the new role names
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'librarian', 'cashier', 'registrar', 'signatory', 'super_admin'));

-- 4. Add designation column for signatories
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS designation TEXT;

-- 5. Backfill designations for existing signatory accounts based on known emails
UPDATE profiles SET designation = 'Department Chairman'
  WHERE role = 'signatory' AND id IN (
    SELECT id FROM auth.users WHERE email = 'chairman@isu.edu.ph'
  );

UPDATE profiles SET designation = 'College Dean'
  WHERE role = 'signatory' AND id IN (
    SELECT id FROM auth.users WHERE email = 'dean@isu.edu.ph'
  );

UPDATE profiles SET designation = 'Director of Student Affairs'
  WHERE role = 'signatory' AND id IN (
    SELECT id FROM auth.users WHERE email = 'dsa@isu.edu.ph'
  );

UPDATE profiles SET designation = 'NSTP Director'
  WHERE role = 'signatory' AND id IN (
    SELECT id FROM auth.users WHERE email = 'nstp@isu.edu.ph'
  );

UPDATE profiles SET designation = 'Executive Officer'
  WHERE role = 'signatory' AND id IN (
    SELECT id FROM auth.users WHERE email = 'executive@isu.edu.ph'
  );

UPDATE profiles SET designation = 'Dean of Graduate School'
  WHERE role = 'signatory' AND id IN (
    SELECT id FROM auth.users WHERE email = 'gradschool@isu.edu.ph'
  );

-- 6. Drop old CHECK constraint on admin_secret_codes if it exists
ALTER TABLE admin_secret_codes DROP CONSTRAINT IF EXISTS admin_secret_codes_role_check;

-- 7. Update admin_secret_codes table role values
UPDATE admin_secret_codes SET role = 'librarian'  WHERE role = 'library_admin';
UPDATE admin_secret_codes SET role = 'cashier'    WHERE role = 'cashier_admin';
UPDATE admin_secret_codes SET role = 'registrar'  WHERE role = 'registrar_admin';
UPDATE admin_secret_codes SET role = 'signatory'  WHERE role = 'professor';

-- 8. Add new CHECK constraint on admin_secret_codes
ALTER TABLE admin_secret_codes ADD CONSTRAINT admin_secret_codes_role_check
  CHECK (role IN ('librarian', 'cashier', 'registrar', 'signatory'));
