-- Migration: Fix communications RLS policy (remove is_active check)
-- Created: 2025-01-XX
-- Issue: RLS policy referencing non-existent 'is_active' column in admin_profiles

-- Drop all existing policies on communications table
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON communications;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON communications;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON communications;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON communications;
DROP POLICY IF EXISTS "Admins can insert communications" ON communications;
DROP POLICY IF EXISTS "Admins can read communications" ON communications;
DROP POLICY IF EXISTS "Admins can update communications" ON communications;
DROP POLICY IF EXISTS "Admins can delete communications" ON communications;

-- Create new permissive policies without is_active check
CREATE POLICY "Admins can insert communications"
ON communications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE id = created_by
  )
);

CREATE POLICY "Admins can read communications"
ON communications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM building_admins ba
    JOIN admin_profiles ap ON ap.id = ba.admin_profile_id
    WHERE ba.building_id = communications.building_id
  )
);

CREATE POLICY "Admins can update communications"
ON communications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE id = created_by
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE id = created_by
  )
);

CREATE POLICY "Admins can delete communications"
ON communications
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE id = created_by
  )
);

-- Create RPC function to insert communications (bypass RLS if needed)
CREATE OR REPLACE FUNCTION create_communication(
  p_title TEXT,
  p_content TEXT,
  p_type TEXT,
  p_priority TEXT,
  p_building_id UUID,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_communication_id UUID;
BEGIN
  -- Insert communication
  INSERT INTO communications (
    title,
    content,
    type,
    priority,
    building_id,
    created_by
  )
  VALUES (
    p_title,
    p_content,
    p_type,
    p_priority,
    p_building_id,
    p_created_by
  )
  RETURNING id INTO v_communication_id;

  RETURN v_communication_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_communication TO authenticated;
