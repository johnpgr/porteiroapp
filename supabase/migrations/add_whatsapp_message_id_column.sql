-- Add whatsapp_message_id column to visitor_logs table
-- This column will store the WhatsApp message ID for tracking purposes

ALTER TABLE visitor_logs 
ADD COLUMN whatsapp_message_id VARCHAR(255);

-- Add comment to the new column
COMMENT ON COLUMN visitor_logs.whatsapp_message_id IS 'ID da mensagem WhatsApp enviada para rastreamento';

-- Grant permissions to anon and authenticated roles
GRANT SELECT, UPDATE ON visitor_logs TO anon;
GRANT SELECT, UPDATE ON visitor_logs TO authenticated;