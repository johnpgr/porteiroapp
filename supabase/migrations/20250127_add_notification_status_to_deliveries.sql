-- Add notification_status field to deliveries table
-- This field is required by the RegistrarEncomenda.tsx form

ALTER TABLE deliveries 
ADD COLUMN notification_status VARCHAR(20) DEFAULT 'delivered' 
CHECK (notification_status IN ('pending', 'delivered', 'returned'));

-- Add comment to explain the field
COMMENT ON COLUMN deliveries.notification_status IS 'Status da notificação da entrega: pending, delivered, returned';

-- Create index for better query performance
CREATE INDEX idx_deliveries_notification_status ON deliveries(notification_status);

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE ON deliveries TO anon;
GRANT SELECT, INSERT, UPDATE ON deliveries TO authenticated;