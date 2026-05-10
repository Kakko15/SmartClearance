-- ============================================
-- Delete a student user and ALL related data
-- ============================================
-- Replace the UUID below with the student's profile ID
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)

DO $$
DECLARE
  v_user_id UUID := '225bb413-8c48-4e6e-9d6c-0fc1d0011984';
  req_ids INT[];
BEGIN
  -- 1. Collect all request IDs for this student
  SELECT ARRAY_AGG(id) INTO req_ids
  FROM requests
  WHERE student_id = v_user_id;

  IF req_ids IS NOT NULL THEN
    -- 2. Delete records referencing requests
    DELETE FROM clearance_certificates WHERE request_id = ANY(req_ids);
    DELETE FROM clearance_comments WHERE clearance_request_id = ANY(req_ids);
    DELETE FROM clearance_status_history WHERE request_id = ANY(req_ids);
    DELETE FROM professor_approvals WHERE request_id = ANY(req_ids);
    DELETE FROM request_comments WHERE request_id = ANY(req_ids);
    DELETE FROM request_documents WHERE request_id = ANY(req_ids);
    DELETE FROM request_history WHERE request_id = ANY(req_ids);
    DELETE FROM escalation_history WHERE request_id = ANY(req_ids);
    DELETE FROM notification_logs WHERE request_id = ANY(req_ids);
    DELETE FROM notifications WHERE related_request_id = ANY(req_ids);

    -- 3. Delete the requests themselves
    DELETE FROM requests WHERE student_id = v_user_id;
  END IF;

  -- 4. Delete other profile-linked records
  DELETE FROM student_professors WHERE student_id = v_user_id;
  DELETE FROM profile_edit_requests WHERE user_id = v_user_id;
  DELETE FROM notifications WHERE user_id = v_user_id;
  DELETE FROM admin_actions WHERE admin_id = v_user_id OR admin_actions.target_user_id = v_user_id;
  DELETE FROM announcements WHERE created_by = v_user_id;
  DELETE FROM audit_log WHERE actor_id = v_user_id;

  -- 5. Nullify references where this user reviewed/approved others
  UPDATE request_history SET processed_by = NULL WHERE processed_by = v_user_id;
  UPDATE clearance_status_history SET changed_by = NULL WHERE changed_by = v_user_id;
  UPDATE clearance_comments SET resolved_by = NULL WHERE resolved_by = v_user_id;
  UPDATE profile_edit_requests SET reviewed_by = NULL WHERE reviewed_by = v_user_id;
  UPDATE requests SET library_approved_by = NULL WHERE library_approved_by = v_user_id;
  UPDATE requests SET cashier_approved_by = NULL WHERE cashier_approved_by = v_user_id;
  UPDATE requests SET registrar_approved_by = NULL WHERE registrar_approved_by = v_user_id;

  -- 6. Delete auth-related records
  DELETE FROM otp_tokens WHERE user_id = v_user_id;
  DELETE FROM auth_audit_log WHERE user_id = v_user_id;
  DELETE FROM user_login_history WHERE user_id = v_user_id;
  DELETE FROM notification_logs WHERE user_id = v_user_id;
  DELETE FROM admin_secret_codes WHERE used_by = v_user_id;

  -- 7. Delete the profile
  DELETE FROM profiles WHERE id = v_user_id;

  -- 8. Delete from Supabase Auth
  DELETE FROM auth.users WHERE id = v_user_id;

  RAISE NOTICE 'Successfully deleted user % and all related data', v_user_id;
END $$;
