-- Remove the problematic trigger that's causing the resident_response_by error
-- and use a simpler approach

-- Drop the trigger that might be causing issues
DROP TRIGGER IF EXISTS trigger_update_resident_response_tracking ON visitor_logs;
DROP FUNCTION IF EXISTS update_resident_response_tracking();

-- Instead, we'll rely on the application to set resident_response_by directly
-- The usePendingNotifications hook has been updated to include this field

-- Ensure the RLS policy allows updating resident_response_by
DROP POLICY IF EXISTS "Residents can update visitor notifications including response tracking" ON visitor_logs;

CREATE POLICY "Residents can update visitor notifications including response tracking" ON visitor_logs
    FOR UPDATE USING (
        apartment_id IN (
            SELECT apartment_id 
            FROM apartment_residents 
            WHERE profile_id = auth.uid()
        )
    )
    WITH CHECK (
        apartment_id IN (
            SELECT apartment_id 
            FROM apartment_residents 
            WHERE profile_id = auth.uid()
        )
    );

-- Grant update permission on the specific field
GRANT UPDATE (notification_status, resident_response_at, resident_response_by, rejection_reason, delivery_destination) ON visitor_logs TO authenticated;

-- Add comment
COMMENT ON COLUMN visitor_logs.resident_response_by IS 'ID of the resident who responded to the notification';