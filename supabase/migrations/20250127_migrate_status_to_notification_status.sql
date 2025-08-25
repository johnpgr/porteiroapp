-- Migration: Replace 'status' field with 'notification_status' in visitor_logs
-- This migration ensures all data uses the new notification_status field
-- and deprecates the old status field

-- First, copy any remaining data from status to notification_status where notification_status is null
UPDATE visitor_logs 
SET notification_status = CASE 
    WHEN status = 'pending' THEN 'pending'::character varying
    WHEN status = 'approved' THEN 'approved'::character varying
    WHEN status = 'denied' THEN 'rejected'::character varying
    WHEN status = 'entered' THEN 'approved'::character varying
    WHEN status = 'exited' THEN 'approved'::character varying
    WHEN status = 'permanent' THEN 'approved'::character varying
    ELSE 'pending'::character varying
END
WHERE notification_status IS NULL OR notification_status = '';

-- Update any remaining null notification_status to 'pending'
UPDATE visitor_logs 
SET notification_status = 'pending'::character varying
WHERE notification_status IS NULL;

-- Add a comment to the status field indicating it's deprecated
COMMENT ON COLUMN visitor_logs.status IS 'DEPRECATED: Use notification_status instead. This field will be removed in a future migration.';

-- Create an index on notification_status for better query performance
CREATE INDEX IF NOT EXISTS idx_visitor_logs_notification_status ON visitor_logs(notification_status);

-- Create an index on notification_status with created_at for common queries
CREATE INDEX IF NOT EXISTS idx_visitor_logs_notification_status_created_at ON visitor_logs(notification_status, created_at DESC);

-- Update RLS policies to use notification_status instead of status
-- Drop existing policies that might reference status
DROP POLICY IF EXISTS "Residents can view notifications for their apartment" ON visitor_logs;
DROP POLICY IF EXISTS "Residents can update notification responses" ON visitor_logs;

-- Recreate policies using notification_status
CREATE POLICY "Residents can view notifications for their apartment" ON visitor_logs
    FOR SELECT USING (
        apartment_id IN (
            SELECT apartment_id 
            FROM residents 
            WHERE user_id = auth.uid()
        )
        AND requires_resident_approval = true
        AND notification_status IN ('pending', 'approved', 'rejected', 'expired')
    );

CREATE POLICY "Residents can update notification responses" ON visitor_logs
    FOR UPDATE USING (
        apartment_id IN (
            SELECT apartment_id 
            FROM residents 
            WHERE user_id = auth.uid()
        )
        AND requires_resident_approval = true
        AND notification_status = 'pending'
    )
    WITH CHECK (
        apartment_id IN (
            SELECT apartment_id 
            FROM residents 
            WHERE user_id = auth.uid()
        )
        AND notification_status IN ('approved', 'rejected')
    );

-- Grant necessary permissions
GRANT SELECT, UPDATE ON visitor_logs TO authenticated;
GRANT SELECT ON visitor_logs TO anon;

-- Add trigger to automatically sync status with notification_status for backward compatibility
-- This will be removed in a future migration once all code is updated
CREATE OR REPLACE FUNCTION sync_status_with_notification_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When notification_status is updated, sync the old status field for backward compatibility
    IF NEW.notification_status IS DISTINCT FROM OLD.notification_status THEN
        NEW.status = CASE 
            WHEN NEW.notification_status = 'pending' THEN 'pending'
            WHEN NEW.notification_status = 'approved' THEN 'approved'
            WHEN NEW.notification_status = 'rejected' THEN 'denied'
            WHEN NEW.notification_status = 'expired' THEN 'denied'
            ELSE 'pending'
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for backward compatibility
DROP TRIGGER IF EXISTS sync_status_trigger ON visitor_logs;
CREATE TRIGGER sync_status_trigger
    BEFORE UPDATE ON visitor_logs
    FOR EACH ROW
    EXECUTE FUNCTION sync_status_with_notification_status();

-- Log the migration
INSERT INTO migration_log (migration_name, executed_at, description)
VALUES (
    '20250127_migrate_status_to_notification_status',
    NOW(),
    'Migrated status field to notification_status, added backward compatibility trigger, updated RLS policies'
) ON CONFLICT (migration_name) DO NOTHING;