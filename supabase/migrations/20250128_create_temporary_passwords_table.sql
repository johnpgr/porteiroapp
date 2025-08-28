-- Migration: Create temporary_passwords table
-- This table tracks temporary passwords generated for new residents

-- Create temporary_passwords table
CREATE TABLE IF NOT EXISTS temporary_passwords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    plain_password TEXT NOT NULL, -- Store plain password for WhatsApp notification
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + INTERVAL '7 days')
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_temporary_passwords_profile_id ON temporary_passwords(profile_id);
CREATE INDEX IF NOT EXISTS idx_temporary_passwords_used ON temporary_passwords(used);
CREATE INDEX IF NOT EXISTS idx_temporary_passwords_expires_at ON temporary_passwords(expires_at);

-- Enable RLS
ALTER TABLE temporary_passwords ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow service role to manage all temporary passwords
CREATE POLICY "Service role can manage temporary passwords" ON temporary_passwords
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to view their own temporary passwords
CREATE POLICY "Users can view own temporary passwords" ON temporary_passwords
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = temporary_passwords.profile_id 
            AND profiles.user_id = auth.uid()
        )
    );

-- Allow authenticated users to update their own temporary passwords (mark as used)
CREATE POLICY "Users can update own temporary passwords" ON temporary_passwords
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = temporary_passwords.profile_id 
            AND profiles.user_id = auth.uid()
        )
    );

-- Grant permissions to roles
GRANT ALL ON temporary_passwords TO service_role;
GRANT SELECT, UPDATE ON temporary_passwords TO authenticated;
GRANT SELECT, UPDATE ON temporary_passwords TO anon;

-- Add comments for documentation
COMMENT ON TABLE temporary_passwords IS 'Stores temporary passwords generated for new resident registration';
COMMENT ON COLUMN temporary_passwords.profile_id IS 'Reference to the profile this password belongs to';
COMMENT ON COLUMN temporary_passwords.password_hash IS 'Hashed version of the temporary password';
COMMENT ON COLUMN temporary_passwords.plain_password IS 'Plain text password for WhatsApp notification (will be cleared after use)';
COMMENT ON COLUMN temporary_passwords.used IS 'Whether this temporary password has been used';
COMMENT ON COLUMN temporary_passwords.expires_at IS 'When this temporary password expires (default 7 days)';

COMMIT;