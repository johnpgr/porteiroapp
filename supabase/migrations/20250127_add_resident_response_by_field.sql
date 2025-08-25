-- Add resident_response_by field to visitor_logs table
-- This field will store the UUID of the resident who responded to the notification

ALTER TABLE visitor_logs 
ADD COLUMN resident_response_by UUID;

-- Add comment to explain the field
COMMENT ON COLUMN visitor_logs.resident_response_by IS 'UUID do morador que respondeu à notificação';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_visitor_logs_resident_response_by 
ON visitor_logs(resident_response_by);

-- Add foreign key constraint to profiles table (since residents are stored in profiles)
ALTER TABLE visitor_logs 
ADD CONSTRAINT fk_visitor_logs_resident_response_by 
FOREIGN KEY (resident_response_by) REFERENCES profiles(id);

-- Update RLS policies to allow residents to update their own responses
-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Residents can update notifications for their apartments" ON visitor_logs;

-- Create new policy that allows residents to update notifications including resident_response_by
CREATE POLICY "Residents can update notifications for their apartments" ON visitor_logs
FOR UPDATE USING (
  apartment_id IN (
    SELECT ar.apartment_id 
    FROM apartment_residents ar 
    WHERE ar.profile_id = auth.uid()
  )
)
WITH CHECK (
  apartment_id IN (
    SELECT ar.apartment_id 
    FROM apartment_residents ar 
    WHERE ar.profile_id = auth.uid()
  )
);

-- Grant necessary permissions
GRANT UPDATE (resident_response_by, notification_status, resident_response_at, rejection_reason) ON visitor_logs TO authenticated;