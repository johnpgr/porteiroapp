-- Add registration token columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS registration_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Add comments for the new columns
COMMENT ON COLUMN public.profiles.registration_token IS 'Token único gerado durante o pré-cadastro do morador para validação posterior';
COMMENT ON COLUMN public.profiles.token_expires_at IS 'Data e hora de expiração do token de registro do morador';

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_registration_token ON public.profiles(registration_token) WHERE registration_token IS NOT NULL;