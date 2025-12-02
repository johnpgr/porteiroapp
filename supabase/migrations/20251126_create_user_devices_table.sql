-- Migration: Create user_devices table for push token management
-- Per VoIP integration documentation Section 4
-- This normalizes token storage: one row per device, supports multiple devices per user,
-- distinguishes VoIP vs standard tokens, and tracks sandbox vs production environments.

-- Create user_devices table
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  token_type TEXT NOT NULL CHECK (token_type IN ('voip', 'standard')),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')) DEFAULT 'production',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: same token can't be registered twice
  CONSTRAINT user_devices_token_unique UNIQUE (device_token)
);

-- Index for efficient lookups by user
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);

-- Index for efficient lookups by token type (VoIP vs standard)
CREATE INDEX IF NOT EXISTS idx_user_devices_token_type ON public.user_devices(token_type);

-- Index for platform-specific queries
CREATE INDEX IF NOT EXISTS idx_user_devices_platform ON public.user_devices(platform);

-- Composite index for common query pattern: user's iOS VoIP tokens
CREATE INDEX IF NOT EXISTS idx_user_devices_user_platform_type 
  ON public.user_devices(user_id, platform, token_type);

-- Enable Row Level Security
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view only their own devices
CREATE POLICY "Users view own devices"
ON public.user_devices
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Users can register their own devices
CREATE POLICY "Users register own devices"
ON public.user_devices
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own devices (e.g., token rotation)
-- Both USING and WITH CHECK are required to prevent user_id reassignment attacks
CREATE POLICY "Users update own devices"
ON public.user_devices
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own devices (logout, uninstall)
CREATE POLICY "Users delete own devices"
ON public.user_devices
FOR DELETE
USING (auth.uid() = user_id);

-- Policy 5: Service role bypasses RLS implicitly, but we grant explicit access
-- for the backend to query other users' tokens when initiating calls
-- (No explicit policy needed - service_role key bypasses RLS)

-- Add comments for documentation
COMMENT ON TABLE public.user_devices IS 'Stores push notification tokens for user devices. Supports multiple devices per user and distinguishes VoIP from standard tokens.';
COMMENT ON COLUMN public.user_devices.device_token IS 'The raw push token (APNs hex string for iOS VoIP, Expo token for standard)';
COMMENT ON COLUMN public.user_devices.platform IS 'Device platform: ios or android';
COMMENT ON COLUMN public.user_devices.token_type IS 'Token type: voip (PushKit) or standard (Expo/FCM)';
COMMENT ON COLUMN public.user_devices.environment IS 'APNs environment: sandbox (development) or production';
COMMENT ON COLUMN public.user_devices.updated_at IS 'Last update timestamp, used for pruning stale tokens';

-- Create function to update updated_at on modification
CREATE OR REPLACE FUNCTION public.update_user_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER user_devices_updated_at
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_devices_updated_at();
