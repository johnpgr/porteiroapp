-- Add token_expires_at column to visitors table
ALTER TABLE public.visitors 
ADD COLUMN token_expires_at TIMESTAMP WITH TIME ZONE;

-- Add comment to describe the column
COMMENT ON COLUMN public.visitors.token_expires_at IS 'Data e hora de expiração do token de registro do visitante';