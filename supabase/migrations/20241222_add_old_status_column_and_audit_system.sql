-- Migration: Add old_status column and implement audit system for notification_audit_log
-- This migration resolves the error: column "old_status" of relation "notification_audit_log" does not exist

-- 1. Add the missing old_status column to notification_audit_log table
ALTER TABLE notification_audit_log 
ADD COLUMN IF NOT EXISTS old_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS new_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS changed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS action_type VARCHAR(50);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_audit_log_visitor_log_id ON notification_audit_log(visitor_log_id);
CREATE INDEX IF NOT EXISTS idx_notification_audit_log_changed_at ON notification_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_audit_log_user_id ON notification_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_audit_log_apartment_id ON notification_audit_log(apartment_id);

-- 3. Create function to handle visitor_logs status changes audit
CREATE OR REPLACE FUNCTION audit_visitor_logs_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log when notification_status changes
    IF OLD.notification_status IS DISTINCT FROM NEW.notification_status THEN
        INSERT INTO notification_audit_log (
            event_type,
            visitor_log_id,
            user_id,
            apartment_id,
            old_status,
            new_status,
            changed_by,
            changed_at,
            action_type,
            response_type,
            metadata
        ) VALUES (
            'status_change',
            NEW.id,
            NEW.authorized_by,
            NEW.apartment_id,
            OLD.notification_status,
            NEW.notification_status,
            NEW.authorized_by,
            NOW(),
            CASE 
                WHEN NEW.notification_status = 'approved' THEN 'accept'
                WHEN NEW.notification_status = 'denied' THEN 'reject'
                ELSE 'update'
            END,
            NEW.notification_status,
            jsonb_build_object(
                'guest_name', NEW.guest_name,
                'delivery_sender', NEW.delivery_sender,
                'purpose', NEW.purpose,
                'entry_type', NEW.entry_type,
                'previous_status', OLD.notification_status,
                'timestamp', NOW()
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger for visitor_logs status changes
DROP TRIGGER IF EXISTS trigger_audit_visitor_logs_status ON visitor_logs;
CREATE TRIGGER trigger_audit_visitor_logs_status
    AFTER UPDATE ON visitor_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_visitor_logs_status_change();

-- 5. Update RLS policies for notification_audit_log
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own audit logs" ON notification_audit_log;
DROP POLICY IF EXISTS "Users can insert audit logs" ON notification_audit_log;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON notification_audit_log;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view their own audit logs" ON notification_audit_log
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.uid() = changed_by OR
        apartment_id IN (
            SELECT apartment_id 
            FROM apartment_residents ar
            JOIN profiles p ON ar.profile_id = p.id
            WHERE p.id = auth.uid() AND ar.is_active = true
        )
    );

CREATE POLICY "System can insert audit logs" ON notification_audit_log
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all audit logs" ON notification_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE user_id = auth.uid()
        )
    );

-- 6. Grant necessary permissions
GRANT SELECT, INSERT ON notification_audit_log TO authenticated;
GRANT SELECT, INSERT ON notification_audit_log TO anon;

-- 7. Enable realtime for notification_audit_log table
ALTER PUBLICATION supabase_realtime ADD TABLE notification_audit_log;

-- 8. Create function to get real-time notification updates for doorman
CREATE OR REPLACE FUNCTION get_pending_notifications_with_status(building_id_param UUID)
RETURNS TABLE (
    visitor_log_id UUID,
    guest_name VARCHAR,
    delivery_sender VARCHAR,
    purpose TEXT,
    entry_type VARCHAR,
    apartment_number VARCHAR,
    resident_name VARCHAR,
    notification_status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vl.id as visitor_log_id,
        vl.guest_name,
        vl.delivery_sender,
        vl.purpose,
        vl.entry_type,
        a.number as apartment_number,
        p.full_name as resident_name,
        vl.notification_status,
        vl.created_at,
        COALESCE(nal.changed_at, vl.created_at) as last_updated
    FROM visitor_logs vl
    JOIN apartments a ON vl.apartment_id = a.id
    LEFT JOIN profiles p ON vl.authorized_by = p.id
    LEFT JOIN LATERAL (
        SELECT changed_at 
        FROM notification_audit_log 
        WHERE visitor_log_id = vl.id 
        ORDER BY changed_at DESC 
        LIMIT 1
    ) nal ON true
    WHERE a.building_id = building_id_param
    AND vl.notification_status IN ('pending', 'approved', 'rejected')
    ORDER BY COALESCE(nal.changed_at, vl.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_pending_notifications_with_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_notifications_with_status(UUID) TO anon;

-- 10. Create view for real-time notification status updates
CREATE OR REPLACE VIEW notification_status_updates AS
SELECT 
    nal.id,
    nal.visitor_log_id,
    nal.old_status,
    nal.new_status,
    nal.action_type,
    nal.changed_at,
    vl.guest_name,
    vl.delivery_sender,
    vl.purpose,
    vl.entry_type,
    a.number as apartment_number,
    a.building_id,
    p.full_name as resident_name
FROM notification_audit_log nal
JOIN visitor_logs vl ON nal.visitor_log_id = vl.id
JOIN apartments a ON vl.apartment_id = a.id
LEFT JOIN profiles p ON vl.authorized_by = p.id
WHERE nal.event_type = 'status_change'
ORDER BY nal.changed_at DESC;

-- 11. Enable RLS on the view and grant permissions
ALTER VIEW notification_status_updates OWNER TO postgres;
GRANT SELECT ON notification_status_updates TO authenticated;
GRANT SELECT ON notification_status_updates TO anon;

-- 12. Note: Views cannot be added to realtime publication
-- Real-time updates will be handled through the notification_audit_log table

COMMIT;