-- Migration: Rename roles to production-ready names
-- Run this AFTER backing up your database.

-- 1. Update profiles table role values
UPDATE profiles SET role = 'librarian'  WHERE role = 'library_admin';
UPDATE profiles SET role = 'cashier'    WHERE role = 'cashier_admin';
UPDATE profiles SET role = 'registrar'  WHERE role = 'registrar_admin';
UPDATE profiles SET role = 'signatory'  WHERE role = 'professor';

-- 2. Add designation column for signatories
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS designation TEXT;

-- 3. Backfill designations for existing signatory accounts based on known emails
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

-- 4. Update admin_secret_codes table role values
UPDATE admin_secret_codes SET role = 'librarian'  WHERE role = 'library_admin';
UPDATE admin_secret_codes SET role = 'cashier'    WHERE role = 'cashier_admin';
UPDATE admin_secret_codes SET role = 'registrar'  WHERE role = 'registrar_admin';
UPDATE admin_secret_codes SET role = 'signatory'  WHERE role = 'professor';
