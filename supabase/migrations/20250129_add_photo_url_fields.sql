-- Add photo_url field to deliveries table
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add photo_url field to visitor_logs table
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add indexes for performance on photo_url fields
CREATE INDEX IF NOT EXISTS idx_deliveries_photo_url ON deliveries(photo_url) WHERE photo_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitor_logs_photo_url ON visitor_logs(photo_url) WHERE photo_url IS NOT NULL;

-- Add comments to document the new fields
COMMENT ON COLUMN deliveries.photo_url IS 'URL of the delivery photo stored in Supabase Storage';
COMMENT ON COLUMN visitor_logs.photo_url IS 'URL of the visitor photo stored in Supabase Storage';