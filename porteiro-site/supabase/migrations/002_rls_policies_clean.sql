-- Clean and recreate RLS policies for Porteiro Site
-- This migration removes existing policies and recreates them with correct column references

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super admins can view all buildings" ON buildings;
DROP POLICY IF EXISTS "Regular admins can view their buildings" ON buildings;
DROP POLICY IF EXISTS "Super admins can insert buildings" ON buildings;
DROP POLICY IF EXISTS "Super admins can update all buildings" ON buildings;
DROP POLICY IF EXISTS "Regular admins can update their buildings" ON buildings;
DROP POLICY IF EXISTS "Super admins can delete buildings" ON buildings;

DROP POLICY IF EXISTS "Super admins can view all admin profiles" ON admin_profiles;
DROP POLICY IF EXISTS "Regular admins can view their own profile" ON admin_profiles;
DROP POLICY IF EXISTS "Super admins can insert admin profiles" ON admin_profiles;
DROP POLICY IF EXISTS "Super admins can update admin profiles" ON admin_profiles;
DROP POLICY IF EXISTS "Regular admins can update their own profile" ON admin_profiles;
DROP POLICY IF EXISTS "Super admins can delete admin profiles" ON admin_profiles;

DROP POLICY IF EXISTS "Super admins can view all building admins" ON building_admins;
DROP POLICY IF EXISTS "Regular admins can view their building assignments" ON building_admins;
DROP POLICY IF EXISTS "Super admins can insert building admins" ON building_admins;
DROP POLICY IF EXISTS "Super admins can update building admins" ON building_admins;
DROP POLICY IF EXISTS "Super admins can delete building admins" ON building_admins;

DROP POLICY IF EXISTS "Super admins can view all apartments" ON apartments;
DROP POLICY IF EXISTS "Regular admins can view apartments in their buildings" ON apartments;
DROP POLICY IF EXISTS "Admins can insert apartments in their buildings" ON apartments;
DROP POLICY IF EXISTS "Admins can update apartments in their buildings" ON apartments;
DROP POLICY IF EXISTS "Admins can delete apartments in their buildings" ON apartments;

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Regular admins can view profiles in their buildings" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles for their buildings" ON profiles;

DROP POLICY IF EXISTS "Super admins can view all apartment residents" ON apartment_residents;
DROP POLICY IF EXISTS "Regular admins can view residents in their buildings" ON apartment_residents;
DROP POLICY IF EXISTS "Residents can view their own apartment assignment" ON apartment_residents;
DROP POLICY IF EXISTS "Admins can insert residents in their buildings" ON apartment_residents;
DROP POLICY IF EXISTS "Admins can update residents in their buildings" ON apartment_residents;
DROP POLICY IF EXISTS "Admins can delete residents in their buildings" ON apartment_residents;

DROP POLICY IF EXISTS "Super admins can view all temporary passwords" ON temporary_passwords;
DROP POLICY IF EXISTS "Regular admins can view temporary passwords for their buildings" ON temporary_passwords;
DROP POLICY IF EXISTS "Admins can insert temporary passwords for their buildings" ON temporary_passwords;
DROP POLICY IF EXISTS "Admins can update temporary passwords for their buildings" ON temporary_passwords;

DROP POLICY IF EXISTS "Super admins can view all visitor temporary passwords" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Regular admins can view visitor passwords for their buildings" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Admins can insert visitor passwords for their buildings" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Admins can update visitor passwords for their buildings" ON visitor_temporary_passwords;

DROP POLICY IF EXISTS "Super admins can view all visitors" ON visitors;
DROP POLICY IF EXISTS "Regular admins can view visitors in their buildings" ON visitors;
DROP POLICY IF EXISTS "Residents can view their own visitors" ON visitors;
DROP POLICY IF EXISTS "Admins can insert visitors for their buildings" ON visitors;
DROP POLICY IF EXISTS "Residents can insert visitors for their apartment" ON visitors;
DROP POLICY IF EXISTS "Admins can update visitors in their buildings" ON visitors;
DROP POLICY IF EXISTS "Admins can delete visitors in their buildings" ON visitors;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS is_super_admin(uuid);
DROP FUNCTION IF EXISTS get_user_building_ids(uuid);
DROP FUNCTION IF EXISTS is_building_admin(uuid, uuid);

-- Enable RLS on all tables
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_temporary_passwords ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE user_id = user_id AND admin_type = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's building IDs (for regular admins)
CREATE OR REPLACE FUNCTION get_user_building_ids(user_id uuid)
RETURNS uuid[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT ba.building_id 
    FROM building_admins ba 
    JOIN admin_profiles ap ON ap.id = ba.admin_profile_id
    WHERE ap.user_id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin of a building
CREATE OR REPLACE FUNCTION is_building_admin(user_id uuid, building_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM building_admins ba
    JOIN admin_profiles ap ON ap.id = ba.admin_profile_id
    WHERE ap.user_id = user_id AND ba.building_id = building_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- BUILDINGS TABLE POLICIES
CREATE POLICY "Super admins can view all buildings" ON buildings
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can view their buildings" ON buildings
  FOR SELECT USING (id = ANY(get_user_building_ids(auth.uid())));

CREATE POLICY "Super admins can insert buildings" ON buildings
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all buildings" ON buildings
  FOR UPDATE USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can update their buildings" ON buildings
  FOR UPDATE USING (id = ANY(get_user_building_ids(auth.uid())));

CREATE POLICY "Super admins can delete buildings" ON buildings
  FOR DELETE USING (is_super_admin(auth.uid()));

-- ADMIN_PROFILES TABLE POLICIES
CREATE POLICY "Super admins can view all admin profiles" ON admin_profiles
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can view their own profile" ON admin_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Super admins can insert admin profiles" ON admin_profiles
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update admin profiles" ON admin_profiles
  FOR UPDATE USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can update their own profile" ON admin_profiles
  FOR UPDATE USING (user_id = auth.uid() AND NOT is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete admin profiles" ON admin_profiles
  FOR DELETE USING (is_super_admin(auth.uid()));

-- BUILDING_ADMINS TABLE POLICIES
CREATE POLICY "Super admins can view all building admins" ON building_admins
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can view their building assignments" ON building_admins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_profiles ap 
      WHERE ap.id = admin_profile_id AND ap.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can insert building admins" ON building_admins
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update building admins" ON building_admins
  FOR UPDATE USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete building admins" ON building_admins
  FOR DELETE USING (is_super_admin(auth.uid()));

-- APARTMENTS TABLE POLICIES
CREATE POLICY "Super admins can view all apartments" ON apartments
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can view apartments in their buildings" ON apartments
  FOR SELECT USING (building_id = ANY(get_user_building_ids(auth.uid())));

CREATE POLICY "Admins can insert apartments in their buildings" ON apartments
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid()) OR 
    building_id = ANY(get_user_building_ids(auth.uid()))
  );

CREATE POLICY "Admins can update apartments in their buildings" ON apartments
  FOR UPDATE USING (
    is_super_admin(auth.uid()) OR 
    building_id = ANY(get_user_building_ids(auth.uid()))
  );

CREATE POLICY "Admins can delete apartments in their buildings" ON apartments
  FOR DELETE USING (
    is_super_admin(auth.uid()) OR 
    building_id = ANY(get_user_building_ids(auth.uid()))
  );

-- PROFILES TABLE POLICIES
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Super admins can view all profiles" ON profiles
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can view profiles in their buildings" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM apartment_residents ar
      JOIN apartments a ON a.id = ar.apartment_id
      WHERE ar.profile_id = profiles.id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles for their buildings" ON profiles
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM admin_profiles ap 
      WHERE ap.user_id = auth.uid()
    )
  );

-- APARTMENT_RESIDENTS TABLE POLICIES
CREATE POLICY "Super admins can view all apartment residents" ON apartment_residents
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can view residents in their buildings" ON apartment_residents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM apartments a 
      WHERE a.id = apartment_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Residents can view their own apartment assignment" ON apartment_residents
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Admins can insert residents in their buildings" ON apartment_residents
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM apartments a 
      WHERE a.id = apartment_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Admins can update residents in their buildings" ON apartment_residents
  FOR UPDATE USING (
    is_super_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM apartments a 
      WHERE a.id = apartment_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Admins can delete residents in their buildings" ON apartment_residents
  FOR DELETE USING (
    is_super_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM apartments a 
      WHERE a.id = apartment_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

-- TEMPORARY_PASSWORDS TABLE POLICIES
CREATE POLICY "Super admins can view all temporary passwords" ON temporary_passwords
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can view temporary passwords for their buildings" ON temporary_passwords
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM apartment_residents ar
      JOIN apartments a ON a.id = ar.apartment_id
      WHERE ar.profile_id = temporary_passwords.profile_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Admins can insert temporary passwords for their buildings" ON temporary_passwords
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM apartment_residents ar
      JOIN apartments a ON a.id = ar.apartment_id
      WHERE ar.profile_id = temporary_passwords.profile_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Admins can update temporary passwords for their buildings" ON temporary_passwords
  FOR UPDATE USING (
    is_super_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM apartment_residents ar
      JOIN apartments a ON a.id = ar.apartment_id
      WHERE ar.profile_id = temporary_passwords.profile_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

-- VISITOR_TEMPORARY_PASSWORDS TABLE POLICIES
CREATE POLICY "Super admins can view all visitor temporary passwords" ON visitor_temporary_passwords
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can view visitor passwords for their buildings" ON visitor_temporary_passwords
  FOR SELECT USING (
    visitor_id IS NULL OR
    EXISTS (
      SELECT 1 FROM visitors v
      JOIN apartments a ON a.id = v.apartment_id
      WHERE v.id = visitor_temporary_passwords.visitor_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Admins can insert visitor passwords for their buildings" ON visitor_temporary_passwords
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid()) OR 
    visitor_id IS NULL OR
    EXISTS (
      SELECT 1 FROM visitors v
      JOIN apartments a ON a.id = v.apartment_id
      WHERE v.id = visitor_temporary_passwords.visitor_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Admins can update visitor passwords for their buildings" ON visitor_temporary_passwords
  FOR UPDATE USING (
    is_super_admin(auth.uid()) OR 
    visitor_id IS NULL OR
    EXISTS (
      SELECT 1 FROM visitors v
      JOIN apartments a ON a.id = v.apartment_id
      WHERE v.id = visitor_temporary_passwords.visitor_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

-- VISITORS TABLE POLICIES
CREATE POLICY "Super admins can view all visitors" ON visitors
  FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "Regular admins can view visitors in their buildings" ON visitors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM apartments a 
      WHERE a.id = apartment_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Residents can view their own visitors" ON visitors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM apartment_residents ar
      WHERE ar.apartment_id = visitors.apartment_id 
      AND ar.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert visitors for their buildings" ON visitors
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM apartments a 
      WHERE a.id = apartment_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Residents can insert visitors for their apartment" ON visitors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM apartment_residents ar
      WHERE ar.apartment_id = visitors.apartment_id 
      AND ar.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update visitors in their buildings" ON visitors
  FOR UPDATE USING (
    is_super_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM apartments a 
      WHERE a.id = apartment_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

CREATE POLICY "Admins can delete visitors in their buildings" ON visitors
  FOR DELETE USING (
    is_super_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM apartments a 
      WHERE a.id = apartment_id 
      AND a.building_id = ANY(get_user_building_ids(auth.uid()))
    )
  );

-- Grant permissions to anon and authenticated roles
GRANT SELECT ON buildings TO anon, authenticated;
GRANT SELECT ON apartments TO anon, authenticated;
GRANT SELECT ON apartment_residents TO anon, authenticated;
GRANT SELECT ON admin_profiles TO anon, authenticated;
GRANT SELECT ON building_admins TO anon, authenticated;
GRANT SELECT ON visitors TO anon, authenticated;
GRANT SELECT ON profiles TO anon, authenticated;
GRANT SELECT ON temporary_passwords TO anon, authenticated;
GRANT SELECT ON visitor_temporary_passwords TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON buildings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON apartments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON apartment_residents TO authenticated;
GRANT INSERT, UPDATE, DELETE ON admin_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON building_admins TO authenticated;
GRANT INSERT, UPDATE, DELETE ON visitors TO authenticated;
GRANT INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON temporary_passwords TO authenticated;
GRANT INSERT, UPDATE, DELETE ON visitor_temporary_passwords TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_building_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_building_admin(uuid, uuid) TO authenticated;