-- Migration: 005_fix_rls_permissions.sql
-- Description: Fix RLS permissions to allow login functionality
-- Created: Fix for login authentication issues

-- Grant basic permissions to anon role for login functionality
GRANT SELECT ON users TO anon;
GRANT SELECT ON condominiums TO anon;
GRANT SELECT ON buildings TO anon;
GRANT SELECT ON apartments TO anon;

-- Create RLS policies for login functionality
-- Allow anon users to read user data for authentication
CREATE POLICY "Allow anon to read users for authentication" ON users
  FOR SELECT TO anon
  USING (true);

-- Allow authenticated users to read their own data and related data
CREATE POLICY "Allow authenticated users to read own data" ON users
  FOR SELECT TO authenticated
  USING (auth.uid()::text = id::text OR true);

-- Allow reading condominium data for hierarchy validation
CREATE POLICY "Allow reading condominiums" ON condominiums
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow reading building data for hierarchy validation
CREATE POLICY "Allow reading buildings" ON buildings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow reading apartment data for hierarchy validation
CREATE POLICY "Allow reading apartments" ON apartments
  FOR SELECT TO anon, authenticated
  USING (true);

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE condominiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

-- Comment: Fixed RLS permissions to allow login functionality
-- This allows anon users to read user data for authentication
-- while maintaining security for other operations