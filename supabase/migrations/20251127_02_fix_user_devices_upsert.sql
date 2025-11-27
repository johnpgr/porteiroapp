-- Migration: Fix user_devices upsert for device token reassignment
-- Problem: RLS blocks upsert when a device token was previously registered by a different user
-- Solution: Create a SECURITY DEFINER function that handles reassignment atomically

-- Function to register or reassign a device token
-- This function bypasses RLS to allow device token reassignment between users
-- Security: Only the authenticated user can call this, and it always sets user_id to auth.uid()
CREATE OR REPLACE FUNCTION public.register_device_token(
  p_device_token TEXT,
  p_platform TEXT,
  p_token_type TEXT,
  p_environment TEXT DEFAULT 'production'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_device_id uuid;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  
  -- Ensure user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Validate platform
  IF p_platform NOT IN ('ios', 'android') THEN
    RAISE EXCEPTION 'Invalid platform: %. Must be ios or android', p_platform;
  END IF;
  
  -- Validate token_type
  IF p_token_type NOT IN ('voip', 'standard') THEN
    RAISE EXCEPTION 'Invalid token_type: %. Must be voip or standard', p_token_type;
  END IF;
  
  -- Validate environment
  IF p_environment NOT IN ('sandbox', 'production') THEN
    RAISE EXCEPTION 'Invalid environment: %. Must be sandbox or production', p_environment;
  END IF;
  
  -- Delete any existing row with this device_token (regardless of user_id)
  -- This handles the case where another user previously had this token
  DELETE FROM public.user_devices WHERE device_token = p_device_token;
  
  -- Insert the new token for the current user
  INSERT INTO public.user_devices (
    device_token,
    user_id,
    platform,
    token_type,
    environment,
    created_at,
    updated_at
  ) VALUES (
    p_device_token,
    v_user_id,
    p_platform,
    p_token_type,
    p_environment,
    now(),
    now()
  )
  RETURNING id INTO v_device_id;
  
  RETURN v_device_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.register_device_token(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.register_device_token IS 
'Registers a device push token for the authenticated user. If the token was previously 
registered to a different user, it will be reassigned to the current user. This is 
necessary for shared devices where multiple users may log in/out.';
