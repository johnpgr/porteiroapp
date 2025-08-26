-- Create registration_tokens table for managing token-based registration flows
CREATE TABLE IF NOT EXISTS registration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    token_type TEXT NOT NULL CHECK (token_type IN ('user_registration', 'visitor_registration', 'visit_approval')),
    entity_id UUID NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('profile', 'visitor', 'visit')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_registration_tokens_token ON registration_tokens(token);
CREATE INDEX IF NOT EXISTS idx_registration_tokens_entity ON registration_tokens(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_registration_tokens_expires_at ON registration_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_registration_tokens_is_used ON registration_tokens(is_used);

-- Enable RLS
ALTER TABLE registration_tokens ENABLE ROW LEVEL SECURITY;

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE ON registration_tokens TO anon;
GRANT ALL PRIVILEGES ON registration_tokens TO authenticated;

-- Create RLS policies
-- Allow anonymous users to read tokens for validation
CREATE POLICY "Allow anonymous token validation" ON registration_tokens
    FOR SELECT TO anon
    USING (NOT is_used AND expires_at > NOW());

-- Allow anonymous users to update tokens when completing registration
CREATE POLICY "Allow anonymous token completion" ON registration_tokens
    FOR UPDATE TO anon
    USING (NOT is_used AND expires_at > NOW());

-- Allow authenticated users full access to their tokens
CREATE POLICY "Allow authenticated users full access" ON registration_tokens
    FOR ALL TO authenticated
    USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_registration_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER registration_tokens_updated_at_trigger
    BEFORE UPDATE ON registration_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_registration_tokens_updated_at();

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM registration_tokens 
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment on table and columns
COMMENT ON TABLE registration_tokens IS 'Stores tokens for various registration and approval flows';
COMMENT ON COLUMN registration_tokens.token IS 'Unique token string for validation';
COMMENT ON COLUMN registration_tokens.token_type IS 'Type of registration flow: user_registration, visitor_registration, or visit_approval';
COMMENT ON COLUMN registration_tokens.entity_id IS 'ID of the related entity (profile, visitor, or visit)';
COMMENT ON COLUMN registration_tokens.entity_type IS 'Type of the related entity';
COMMENT ON COLUMN registration_tokens.expires_at IS 'When the token expires';
COMMENT ON COLUMN registration_tokens.used_at IS 'When the token was used (NULL if not used)';
COMMENT ON COLUMN registration_tokens.is_used IS 'Whether the token has been used';
COMMENT ON COLUMN registration_tokens.metadata IS 'Additional data for the registration flow';