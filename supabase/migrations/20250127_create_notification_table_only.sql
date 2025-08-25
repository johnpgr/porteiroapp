-- Migration: Create doorkeeper notifications table and basic functions
-- Step 1: Create the table structure only

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

-- 2. Create basic indexes
CREATE INDEX IF NOT EXISTS idx_doorkeeper_notifications_building_id ON doorkeeper_notifications(building_id);
CREATE INDEX IF NOT EXISTS idx_doorkeeper_notifications_acknowledged ON doorkeeper_notifications(acknowledged);
CREATE INDEX IF NOT EXISTS idx_doorkeeper_notifications_priority ON doorkeeper_notifications(priority);

-- 3. Grant basic permissions
GRANT SELECT, INSERT, UPDATE ON doorkeeper_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON doorkeeper_notifications TO anon;

-- 4. Enable RLS
ALTER TABLE doorkeeper_notifications ENABLE ROW LEVEL SECURITY;

-- 5. Create basic RLS policy
CREATE POLICY "Allow authenticated users to manage notifications" ON doorkeeper_notifications
  FOR ALL USING (auth.role() = 'authenticated');

-- 6. Add table comment
COMMENT ON TABLE doorkeeper_notifications IS 'Notifications for doorkeepers when visitor status changes';