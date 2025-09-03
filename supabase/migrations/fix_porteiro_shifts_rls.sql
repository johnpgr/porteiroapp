-- Fix RLS policies for porteiro_shifts table
-- This migration creates proper RLS policies to allow porteiros to manage their shifts

-- First, let's check if there are existing policies and drop them
DROP POLICY IF EXISTS "porteiro_shifts_select_policy" ON porteiro_shifts;
DROP POLICY IF EXISTS "porteiro_shifts_insert_policy" ON porteiro_shifts;
DROP POLICY IF EXISTS "porteiro_shifts_update_policy" ON porteiro_shifts;
DROP POLICY IF EXISTS "porteiro_shifts_delete_policy" ON porteiro_shifts;

-- Enable RLS on the table (if not already enabled)
ALTER TABLE porteiro_shifts ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Allow porteiros to see their own shifts and admins to see all shifts
CREATE POLICY "porteiro_shifts_select_policy" ON porteiro_shifts
  FOR SELECT
  USING (
    -- Allow if user is the porteiro who owns the shift
    porteiro_id = auth.uid()
    OR
    -- Allow if user is an admin of the building where the shift is happening
    EXISTS (
      SELECT 1 FROM building_admins ba
      JOIN profiles p ON p.id = ba.admin_profile_id
      WHERE ba.building_id = porteiro_shifts.building_id
      AND p.user_id = auth.uid()
    )
    OR
    -- Allow if user is a super admin
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Policy for INSERT: Allow porteiros to create shifts for themselves
CREATE POLICY "porteiro_shifts_insert_policy" ON porteiro_shifts
  FOR INSERT
  WITH CHECK (
    -- Allow if the porteiro is creating a shift for themselves
    porteiro_id = auth.uid()
    OR
    -- Allow if user is an admin of the building
    EXISTS (
      SELECT 1 FROM building_admins ba
      JOIN profiles p ON p.id = ba.admin_profile_id
      WHERE ba.building_id = porteiro_shifts.building_id
      AND p.user_id = auth.uid()
    )
    OR
    -- Allow if user is a super admin
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Policy for UPDATE: Allow porteiros to update their own shifts
CREATE POLICY "porteiro_shifts_update_policy" ON porteiro_shifts
  FOR UPDATE
  USING (
    -- Allow if user is the porteiro who owns the shift
    porteiro_id = auth.uid()
    OR
    -- Allow if user is an admin of the building
    EXISTS (
      SELECT 1 FROM building_admins ba
      JOIN profiles p ON p.id = ba.admin_profile_id
      WHERE ba.building_id = porteiro_shifts.building_id
      AND p.user_id = auth.uid()
    )
    OR
    -- Allow if user is a super admin
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    -- Same conditions for the updated row
    porteiro_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM building_admins ba
      JOIN profiles p ON p.id = ba.admin_profile_id
      WHERE ba.building_id = porteiro_shifts.building_id
      AND p.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Policy for DELETE: Allow porteiros to delete their own shifts (for cleanup)
CREATE POLICY "porteiro_shifts_delete_policy" ON porteiro_shifts
  FOR DELETE
  USING (
    -- Allow if user is the porteiro who owns the shift
    porteiro_id = auth.uid()
    OR
    -- Allow if user is an admin of the building
    EXISTS (
      SELECT 1 FROM building_admins ba
      JOIN profiles p ON p.id = ba.admin_profile_id
      WHERE ba.building_id = porteiro_shifts.building_id
      AND p.user_id = auth.uid()
    )
    OR
    -- Allow if user is a super admin
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON porteiro_shifts TO authenticated;

-- Also grant to anon for public access (if needed)
GRANT SELECT ON porteiro_shifts TO anon;

-- Add comment to document the RLS setup
COMMENT ON TABLE porteiro_shifts IS 'Porteiro shifts with RLS policies allowing porteiros to manage their own shifts and admins to manage shifts in their buildings';