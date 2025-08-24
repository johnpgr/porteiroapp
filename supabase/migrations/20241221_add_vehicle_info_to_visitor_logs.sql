-- Add vehicle_info JSONB field to visitor_logs table
-- This field will store vehicle information when a vehicle entry is authorized

ALTER TABLE visitor_logs 
ADD COLUMN vehicle_info JSONB;

-- Add comment to explain the field purpose
COMMENT ON COLUMN visitor_logs.vehicle_info IS 'JSONB field to store vehicle information (license_plate, make, color, model) when authorizing vehicle entry';

-- Create index on vehicle_info for better query performance
CREATE INDEX idx_visitor_logs_vehicle_info ON visitor_logs USING GIN (vehicle_info);

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE ON visitor_logs TO anon;
GRANT SELECT, INSERT, UPDATE ON visitor_logs TO authenticated;