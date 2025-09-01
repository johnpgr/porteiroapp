-- Migration: Add expo_push_token field to profiles table
-- Date: 2025-01-29
-- Purpose: Add expo_push_token field for push notifications

-- Add expo_push_token column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Add index for expo_push_token column for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token 
ON public.profiles (expo_push_token) 
WHERE expo_push_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.expo_push_token IS 'Expo push notification token for sending push notifications to user devices';

-- Grant permissions
GRANT SELECT, UPDATE ON public.profiles TO anon;
GRANT ALL PRIVILEGES ON public.profiles TO authenticated;

-- Success message
SELECT 'Migration completed successfully: expo_push_token field added to profiles table' as status;