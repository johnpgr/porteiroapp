-- Complete removal of all triggers and functions that might reference resident_response_by
-- This is a comprehensive cleanup to resolve the persistent error

-- Drop ALL triggers on visitor_logs table
DO $$ 
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'visitor_logs'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.trigger_name || ' ON visitor_logs CASCADE';
    END LOOP;
END $$;

-- Drop ALL functions that might reference resident_response_by
DO $$ 
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_definition ILIKE '%resident_response_by%'
        AND routine_type = 'FUNCTION'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.routine_name || ' CASCADE';
    END LOOP;
END $$;

-- Recreate only the essential audit trigger (without resident_response_by references)
CREATE OR REPLACE FUNCTION audit_visitor_logs_status_change_safe()
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

-- Create the safe audit trigger
CREATE TRIGGER trigger_audit_visitor_logs_status_safe
    AFTER UPDATE ON visitor_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_visitor_logs_status_change_safe();

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION audit_visitor_logs_status_change_safe() TO authenticated;

-- Final verification - list remaining triggers
SELECT 'Remaining triggers on visitor_logs:' as info;
SELECT trigger_name, action_timing, event_manipulation
FROM information_schema.triggers 
WHERE event_object_table = 'visitor_logs';