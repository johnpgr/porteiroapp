-- Migration: 018_apartments_rls_policies.sql
-- Description: Add RLS policies for apartments table to allow INSERT, UPDATE, DELETE operations
-- Created: Fix for apartment management operations

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow admins to insert apartments" ON apartments;
DROP POLICY IF EXISTS "Allow admins to update apartments" ON apartments;
DROP POLICY IF EXISTS "Allow admins to delete apartments" ON apartments;
DROP POLICY IF EXISTS "Admins can insert apartments in their buildings" ON apartments;
DROP POLICY IF EXISTS "Admins can update apartments in their buildings" ON apartments;
DROP POLICY IF EXISTS "Admins can delete apartments in their buildings" ON apartments;

-- Política para INSERT: Administradores podem inserir apartamentos em prédios do seu condomínio
CREATE POLICY "Admins can insert apartments in their buildings" ON apartments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM building_admins ba
      JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
      WHERE ba.building_id = apartments.building_id
      AND ap.user_id = auth.uid()
    )
  );

-- Política para UPDATE: Administradores podem atualizar apartamentos em prédios do seu condomínio
CREATE POLICY "Admins can update apartments in their buildings" ON apartments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM building_admins ba
      JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
      WHERE ba.building_id = apartments.building_id
      AND ap.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM building_admins ba
      JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
      WHERE ba.building_id = apartments.building_id
      AND ap.user_id = auth.uid()
    )
  );

-- Política para DELETE: Administradores podem deletar apartamentos em prédios do seu condomínio
CREATE POLICY "Admins can delete apartments in their buildings" ON apartments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM building_admins ba
      JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
      WHERE ba.building_id = apartments.building_id
      AND ap.user_id = auth.uid()
    )
  );

-- Ensure RLS is enabled on apartments table
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON apartments TO authenticated;
GRANT SELECT ON apartments TO anon;

-- Comment: Added RLS policies for apartments table
-- This allows admins to manage apartments in their buildings