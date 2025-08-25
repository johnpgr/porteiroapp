-- Migration: Create trigger for real-time notifications on notification_status changes
-- This trigger will detect changes in notification_status and create notifications for doorkeepers

-- 1. Create notifications table for doorkeepers
CREATE TABLE IF NOT EXISTS doorkeeper_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_log_id UUID NOT NULL REFERENCES visitor_logs(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  visitor_name VARCHAR(255) NOT NULL,
  apartment_number VARCHAR(10) NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  change_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for performance (after table creation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_doorkeeper_notifications_building_id') THEN
    CREATE INDEX idx_doorkeeper_notifications_building_id ON doorkeeper_notifications(building_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_doorkeeper_notifications_acknowledged') THEN
    CREATE INDEX idx_doorkeeper_notifications_acknowledged ON doorkeeper_notifications(acknowledged, change_time DESC);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_doorkeeper_notifications_priority') THEN
    CREATE INDEX idx_doorkeeper_notifications_priority ON doorkeeper_notifications(priority, change_time DESC);
  END IF;
END $$;

-- 3. Create function to handle notification_status changes
CREATE OR REPLACE FUNCTION create_doorkeeper_notification()
RETURNS TRIGGER AS $$
DECLARE
  visitor_info RECORD;
  notification_priority VARCHAR(20) := 'normal';
BEGIN
  -- Only create notification if notification_status changed
  IF OLD.notification_status IS DISTINCT FROM NEW.notification_status THEN
    
    -- Get visitor and apartment information
    SELECT v.name, v.document, a.number, a.building_id
    INTO visitor_info
    FROM visitors v
    JOIN apartments a ON a.id = NEW.apartment_id
    WHERE v.id = NEW.visitor_id;
    
    -- Skip if visitor info not found
    IF visitor_info IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Determine priority based on status change
    notification_priority := CASE 
      WHEN NEW.notification_status = 'approved' THEN 'high'
      WHEN NEW.notification_status = 'rejected' THEN 'normal'
      WHEN NEW.notification_status = 'entered' THEN 'urgent'
      WHEN NEW.notification_status = 'pending' THEN 'normal'
      ELSE 'normal'
    END;
    
    -- Insert notification for doorkeepers
    INSERT INTO doorkeeper_notifications (
      visitor_log_id,
      building_id,
      visitor_name,
      apartment_number,
      old_status,
      new_status,
      change_time,
      priority
    ) VALUES (
      NEW.id,
      visitor_info.building_id,
      visitor_info.name,
      visitor_info.number,
      OLD.notification_status,
      NEW.notification_status,
      NOW(),
      notification_priority
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger on visitor_logs table
DROP TRIGGER IF EXISTS trigger_doorkeeper_notification ON visitor_logs;
CREATE TRIGGER trigger_doorkeeper_notification
  AFTER UPDATE ON visitor_logs
  FOR EACH ROW
  EXECUTE FUNCTION create_doorkeeper_notification();

-- 5. Create function to acknowledge notifications
CREATE OR REPLACE FUNCTION acknowledge_notification(
  notification_id UUID,
  user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE doorkeeper_notifications 
  SET 
    acknowledged = TRUE,
    acknowledged_by = user_id,
    acknowledged_at = NOW(),
    updated_at = NOW()
  WHERE id = notification_id AND acknowledged = FALSE;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to get unacknowledged notifications for a building
CREATE OR REPLACE FUNCTION get_unacknowledged_notifications(
  building_id_param UUID,
  limit_param INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  visitor_log_id UUID,
  visitor_name VARCHAR,
  apartment_number VARCHAR,
  old_status VARCHAR,
  new_status VARCHAR,
  change_time TIMESTAMPTZ,
  priority VARCHAR,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dn.id,
    dn.visitor_log_id,
    dn.visitor_name,
    dn.apartment_number,
    dn.old_status,
    dn.new_status,
    dn.change_time,
    dn.priority,
    dn.created_at
  FROM doorkeeper_notifications dn
  WHERE dn.building_id = building_id_param 
    AND dn.acknowledged = FALSE
  ORDER BY 
    CASE dn.priority 
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    dn.change_time DESC
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to get notification history
CREATE OR REPLACE FUNCTION get_notification_history(
  building_id_param UUID,
  limit_param INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  visitor_log_id UUID,
  visitor_name VARCHAR,
  apartment_number VARCHAR,
  old_status VARCHAR,
  new_status VARCHAR,
  change_time TIMESTAMPTZ,
  priority VARCHAR,
  acknowledged BOOLEAN,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dn.id,
    dn.visitor_log_id,
    dn.visitor_name,
    dn.apartment_number,
    dn.old_status,
    dn.new_status,
    dn.change_time,
    dn.priority,
    dn.acknowledged,
    dn.acknowledged_by,
    dn.acknowledged_at,
    dn.created_at
  FROM doorkeeper_notifications dn
  WHERE dn.building_id = building_id_param
  ORDER BY dn.change_time DESC
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- 8. Grant permissions
GRANT SELECT, INSERT, UPDATE ON doorkeeper_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_notification(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unacknowledged_notifications(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_history(UUID, INTEGER) TO authenticated;

-- 9. Enable RLS on doorkeeper_notifications
ALTER TABLE doorkeeper_notifications ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies
DROP POLICY IF EXISTS "Doorkeepers can view notifications for their building" ON doorkeeper_notifications;
CREATE POLICY "Doorkeepers can view notifications for their building" ON doorkeeper_notifications
  FOR SELECT USING (
    building_id IN (
      SELECT p.building_id 
      FROM profiles p 
      WHERE p.user_id = auth.uid() 
        AND p.user_type = 'porteiro'
    )
  );

DROP POLICY IF EXISTS "Doorkeepers can update notifications for their building" ON doorkeeper_notifications;
CREATE POLICY "Doorkeepers can update notifications for their building" ON doorkeeper_notifications
  FOR UPDATE USING (
    building_id IN (
      SELECT p.building_id 
      FROM profiles p 
      WHERE p.user_id = auth.uid() 
        AND p.user_type = 'porteiro'
    )
  );

-- 11. Add comments
COMMENT ON TABLE doorkeeper_notifications IS 'Notifications for doorkeepers when visitor status changes';
COMMENT ON FUNCTION create_doorkeeper_notification() IS 'Trigger function to create notifications on visitor status changes';
COMMENT ON FUNCTION acknowledge_notification(UUID, UUID) IS 'Function to acknowledge a notification';
COMMENT ON FUNCTION get_unacknowledged_notifications(UUID, INTEGER) IS 'Function to get unacknowledged notifications for a building';
COMMENT ON FUNCTION get_notification_history(UUID, INTEGER) IS 'Function to get notification history for a building';