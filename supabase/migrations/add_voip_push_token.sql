-- Migration: Add voip_push_token column for iOS PushKit tokens
-- Created: 2025-11-04
-- Purpose: Store separate iOS VoIP push tokens alongside existing FCM push_token

-- Add voip_push_token to admin_profiles
ALTER TABLE public.admin_profiles
ADD COLUMN IF NOT EXISTS voip_push_token TEXT;

-- Add voip_push_token to profiles (if exists)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS voip_push_token TEXT;

-- Add voip_push_token to doorman_profiles (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doorman_profiles') THEN
        ALTER TABLE public.doorman_profiles
        ADD COLUMN IF NOT EXISTS voip_push_token TEXT;
    END IF;
END $$;

-- Add voip_push_token to resident_profiles (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'resident_profiles') THEN
        ALTER TABLE public.resident_profiles
        ADD COLUMN IF NOT EXISTS voip_push_token TEXT;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN admin_profiles.voip_push_token IS 'iOS PushKit VoIP push token for incoming calls';
COMMENT ON COLUMN profiles.voip_push_token IS 'iOS PushKit VoIP push token for incoming calls';

-- Note: After running this migration, regenerate TypeScript types:
-- npx supabase gen types typescript --project-id YOUR_PROJECT_ID > packages/common/supabase/types/database.ts
