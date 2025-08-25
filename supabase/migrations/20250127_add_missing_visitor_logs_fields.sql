-- Add missing fields to visitor_logs table for notification response system
-- These fields are required by the respondToNotification function

-- Add resident_response_at field to track when resident responded
ALTER TABLE visitor_logs 
ADD COLUMN IF NOT EXISTS resident_response_at TIMESTAMPTZ;

-- Add rejection_reason field to store reason for rejection
ALTER TABLE visitor_logs 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add delivery_destination field for delivery notifications
ALTER TABLE visitor_logs 
ADD COLUMN IF NOT EXISTS delivery_destination TEXT;

-- Create index for resident_response_at for better query performance
CREATE INDEX IF NOT EXISTS idx_visitor_logs_resident_response_at 
ON visitor_logs(resident_response_at) 
WHERE resident_response_at IS NOT NULL;

-- Create index for notification_status and resident_response_at combination
CREATE INDEX IF NOT EXISTS idx_visitor_logs_notification_response 
ON visitor_logs(notification_status, resident_response_at) 
WHERE notification_status IS NOT NULL;

-- Grant necessary permissions to authenticated users
GRANT SELECT, UPDATE ON visitor_logs TO authenticated;

-- Update RLS policies to allow residents to update these new fields
-- This policy should already exist, but we ensure it covers the new fields
DROP POLICY IF EXISTS "residents_can_update_notifications" ON visitor_logs;
CREATE POLICY "residents_can_update_notifications" ON visitor_logs
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM residents r
            WHERE r.user_id = auth.uid()
            AND r.apartment_id = visitor_logs.apartment_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM residents r
            WHERE r.user_id = auth.uid()
            AND r.apartment_id = visitor_logs.apartment_id
        )
    );

-- Add comment to document the purpose of these fields
COMMENT ON COLUMN visitor_logs.resident_response_at IS 'Timestamp when resident responded to the notification';
COMMENT ON COLUMN visitor_logs.rejection_reason IS 'Reason provided by resident when rejecting a visitor/delivery';
COMMENT ON COLUMN visitor_logs.delivery_destination IS 'Destination specified for delivery (e.g., apartment door, reception)';