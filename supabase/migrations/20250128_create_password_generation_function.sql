-- Migration: Create function for generating random 8-character alphanumeric passwords
-- This function will be used by the backend to generate temporary passwords for new residents

-- Create function to generate random 8-character alphanumeric password
CREATE OR REPLACE FUNCTION generate_random_password()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    -- Generate 8 random characters
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_random_password() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_random_password() TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION generate_random_password() IS 'Generates a random 8-character alphanumeric password for new user registration';

COMMIT;