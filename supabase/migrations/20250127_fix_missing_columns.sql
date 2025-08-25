-- Migration: Fix missing columns in notification_audit_log and poll_votes tables
-- Date: 2025-01-27
-- Description: Adds missing change_reason column to notification_audit_log and poll_option_id column to poll_votes

-- 1. Add change_reason column to notification_audit_log table
ALTER TABLE notification_audit_log 
ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- Add comment for documentation
COMMENT ON COLUMN notification_audit_log.change_reason IS 'Motivo da mudança de status da notificação';

-- 2. Add poll_option_id column to poll_votes table
-- This column will reference the poll_options table
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS poll_option_id UUID REFERENCES poll_options(id);

-- Add comment for documentation
COMMENT ON COLUMN poll_votes.poll_option_id IS 'Referência para a opção da enquete votada';

-- 3. Create index for better performance on poll_option_id
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_option_id 
    ON poll_votes(poll_option_id);

-- 4. Update existing poll_votes records to populate poll_option_id from option_id
-- This ensures backward compatibility
UPDATE poll_votes 
SET poll_option_id = option_id 
WHERE poll_option_id IS NULL AND option_id IS NOT NULL;

-- 5. Add constraint to ensure poll_option_id is not null for new records
-- We'll make it nullable initially to handle existing data, but add a check
ALTER TABLE poll_votes 
ADD CONSTRAINT check_poll_option_id_not_null 
CHECK (poll_option_id IS NOT NULL OR option_id IS NOT NULL);

-- 6. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON notification_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON poll_votes TO authenticated;

-- 7. Verify the changes
SELECT 
    'notification_audit_log' as table_name,
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'notification_audit_log' 
    AND column_name = 'change_reason'

UNION ALL

SELECT 
    'poll_votes' as table_name,
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'poll_votes' 
    AND column_name = 'poll_option_id';

-- 8. Create a function to log notification changes with change_reason
CREATE OR REPLACE FUNCTION log_notification_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if notification_status actually changed
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
            change_reason
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
                WHEN NEW.notification_status = 'rejected' THEN 'reject'
                ELSE 'update'
            END,
            CASE 
                WHEN NEW.notification_status = 'approved' THEN 'Notificação aceita pelo morador'
                WHEN NEW.notification_status = 'rejected' THEN 'Notificação rejeitada pelo morador'
                ELSE 'Status da notificação atualizado'
            END
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Update the existing trigger to use the new function
DROP TRIGGER IF EXISTS audit_notification_changes ON visitor_logs;
CREATE TRIGGER audit_notification_changes
    AFTER UPDATE ON visitor_logs
    FOR EACH ROW
    EXECUTE FUNCTION log_notification_status_change();