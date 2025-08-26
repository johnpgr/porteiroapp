-- Check permissions for the registration_tokens table and grant access to anon and authenticated roles

-- Grant basic read access to the anon role for token validation
GRANT SELECT ON public.registration_tokens TO anon;

-- Grant full access to the authenticated role for token management
GRANT ALL PRIVILEGES ON public.registration_tokens TO authenticated;

-- Ensure RLS is enabled (should already be enabled from the table creation)
ALTER TABLE public.registration_tokens ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should already exist from the table creation migration
-- If needed, policies can be created separately