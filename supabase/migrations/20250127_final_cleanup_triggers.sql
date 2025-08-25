-- Final cleanup to ensure no problematic triggers remain
-- This addresses the persistent error: record "new" has no field "resident_response_by"

-- Drop all potentially problematic triggers and functions
DROP TRIGGER IF EXISTS trigger_update_resident_response_tracking ON visitor_logs;
DROP FUNCTION IF EXISTS update_resident_response_tracking();

-- Also check for any other triggers that might be causing issues
DROP TRIGGER IF EXISTS trigger_set_resident_response ON visitor_logs;
DROP FUNCTION IF EXISTS set_resident_response();

-- List all triggers on visitor_logs table to verify cleanup
-- (This is just for verification, won't cause errors)
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'visitor_logs';

-- Ensure the column exists and has proper permissions
ALTER TABLE visitor_logs 
ALTER COLUMN resident_response_by SET DEFAULT NULL;

-- Update RLS policy to be more explicit about allowed updates
DROP POLICY IF EXISTS "Residents can update visitor notifications including response tracking" ON visitor_logs;

CREATE POLICY "Residents can update visitor notifications" ON visitor_logs
    FOR UPDATE USING (
        apartment_id IN (
            SELECT apartment_id 
            FROM apartment_residents 
            WHERE profile_id = auth.uid() AND is_active = true
        )
    )
    WITH CHECK (
        apartment_id IN (
            SELECT apartment_id 
            FROM apartment_residents 
            WHERE profile_id = auth.uid() AND is_active = true
        )
    );

-- Ensure authenticated users can update the necessary fields
GRANT UPDATE (notification_status, resident_response_at, resident_response_by, rejection_reason, delivery_destination) ON visitor_logs TO authenticated;

-- Add helpful comment
COMMENT ON TABLE visitor_logs IS 'Visitor logs with notification response tracking - updated to fix resident_response_by field issues';