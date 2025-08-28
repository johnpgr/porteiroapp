-- Migration: Create RPC function for atomic resident creation with temporary password
-- This function ensures atomicity when creating a resident profile and temporary password

CREATE OR REPLACE FUNCTION create_resident_with_temp_password(
  p_full_name TEXT,
  p_phone TEXT,
  p_apartment_id UUID,
  p_temp_password TEXT,
  p_password_hash TEXT
)
RETURNS JSON AS $$
DECLARE
  v_profile_id UUID;
  v_result JSON;
BEGIN
  -- Start transaction (implicit in function)
  
  -- 1. Insert into profiles table
  INSERT INTO profiles (
    full_name,
    phone,
    role,
    user_type,
    temporary_password_used
  ) VALUES (
    p_full_name,
    p_phone,
    'morador',
    'morador',
    false
  )
  RETURNING id INTO v_profile_id;
  
  -- 2. Insert into temporary_passwords table
  INSERT INTO temporary_passwords (
    profile_id,
    password_hash,
    plain_password,
    phone_number,
    used,
    expires_at
  ) VALUES (
    v_profile_id,
    p_password_hash,
    p_temp_password,
    p_phone,
    false,
    timezone('utc'::text, now()) + '7 days'::interval
  );
  
  -- 3. Insert into apartment_residents table
  INSERT INTO apartment_residents (
    profile_id,
    apartment_id,
    relationship,
    is_primary
  ) VALUES (
    v_profile_id,
    p_apartment_id,
    'morador',
    false
  );
  
  -- Return success with profile data
  SELECT json_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'full_name', p_full_name,
    'phone', p_phone,
    'temporary_password', p_temp_password
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_resident_with_temp_password(TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION create_resident_with_temp_password IS 'Creates a resident profile with temporary password atomically';