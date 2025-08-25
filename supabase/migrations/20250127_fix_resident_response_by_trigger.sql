-- Fix trigger that may be trying to use non-existent resident_response_by field
-- This migration addresses the error: record "new" has no field "resident_response_by"

-- First, let's check if there are any triggers that might be causing this issue
-- and update them to use the correct field names

-- Update the respondToNotification function to also set resident_response_by field
-- when a resident responds to a notification
CREATE OR REPLACE FUNCTION update_resident_response_tracking()
RETURNS TRIGGER AS $$
BEGIN
    -- When notification_status is updated and resident_response_at is set,
    -- also set resident_response_by to track which resident responded
    IF OLD.notification_status IS DISTINCT FROM NEW.notification_status 
       AND NEW.resident_response_at IS NOT NULL 
       AND NEW.resident_response_by IS NULL THEN
        
        -- Set resident_response_by to the current user (from auth context)
        NEW.resident_response_by := auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically set resident_response_by when resident responds
DROP TRIGGER IF EXISTS trigger_update_resident_response_tracking ON visitor_logs;
CREATE TRIGGER trigger_update_resident_response_tracking
    BEFORE UPDATE ON visitor_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_resident_response_tracking();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_resident_response_tracking() TO authenticated;

-- Update any existing records that have resident_response_at but no resident_response_by
-- This is a one-time cleanup for existing data
UPDATE visitor_logs 
SET resident_response_by = authorized_by
WHERE resident_response_at IS NOT NULL 
  AND resident_response_by IS NULL 
  AND authorized_by IS NOT NULL;

-- Add comment to document the purpose
COMMENT ON FUNCTION update_resident_response_tracking() IS 'Automatically sets resident_response_by when a resident responds to a notification';