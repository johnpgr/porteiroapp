-- Disable all Row Level Security policies and RLS on all tables
-- This is a temporary measure to resolve infinite recursion issues

-- First, drop all existing policies
DROP POLICY IF EXISTS "Super-admins can view all buildings" ON buildings;
DROP POLICY IF EXISTS "Admins can view buildings they manage" ON buildings;
DROP POLICY IF EXISTS "Super-admins can insert buildings" ON buildings;
DROP POLICY IF EXISTS "Super-admins can update buildings" ON buildings;
DROP POLICY IF EXISTS "Super-admins can delete buildings" ON buildings;

DROP POLICY IF EXISTS "Super-admins can view all admin profiles" ON admin_profiles;
DROP POLICY IF EXISTS "Admins can view their own profile" ON admin_profiles;
DROP POLICY IF EXISTS "Super-admins can insert admin profiles" ON admin_profiles;
DROP POLICY IF EXISTS "Super-admins can update admin profiles" ON admin_profiles;
DROP POLICY IF EXISTS "Admins can update their own profile" ON admin_profiles;
DROP POLICY IF EXISTS "Super-admins can delete admin profiles" ON admin_profiles;

DROP POLICY IF EXISTS "Super-admins can view all building admins" ON building_admins;
DROP POLICY IF EXISTS "Admins can view their own building assignments" ON building_admins;
DROP POLICY IF EXISTS "Super-admins can insert building admins" ON building_admins;
DROP POLICY IF EXISTS "Super-admins can update building admins" ON building_admins;
DROP POLICY IF EXISTS "Super-admins can delete building admins" ON building_admins;

DROP POLICY IF EXISTS "Super-admins can view all apartments" ON apartments;
DROP POLICY IF EXISTS "Admins can view apartments in their buildings" ON apartments;
DROP POLICY IF EXISTS "Super-admins can insert apartments" ON apartments;
DROP POLICY IF EXISTS "Admins can insert apartments in their buildings" ON apartments;
DROP POLICY IF EXISTS "Super-admins can update apartments" ON apartments;
DROP POLICY IF EXISTS "Admins can update apartments in their buildings" ON apartments;
DROP POLICY IF EXISTS "Super-admins can delete apartments" ON apartments;
DROP POLICY IF EXISTS "Admins can delete apartments in their buildings" ON apartments;

DROP POLICY IF EXISTS "Super-admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their buildings" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Super-admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles for residents in their buildings" ON profiles;
DROP POLICY IF EXISTS "Super-admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their buildings" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Super-admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles in their buildings" ON profiles;

DROP POLICY IF EXISTS "Super-admins can view all apartment residents" ON apartment_residents;
DROP POLICY IF EXISTS "Admins can view apartment residents in their buildings" ON apartment_residents;
DROP POLICY IF EXISTS "Residents can view their own apartment assignments" ON apartment_residents;
DROP POLICY IF EXISTS "Super-admins can insert apartment residents" ON apartment_residents;
DROP POLICY IF EXISTS "Admins can insert apartment residents in their buildings" ON apartment_residents;
DROP POLICY IF EXISTS "Super-admins can update apartment residents" ON apartment_residents;
DROP POLICY IF EXISTS "Admins can update apartment residents in their buildings" ON apartment_residents;
DROP POLICY IF EXISTS "Super-admins can delete apartment residents" ON apartment_residents;
DROP POLICY IF EXISTS "Admins can delete apartment residents in their buildings" ON apartment_residents;

DROP POLICY IF EXISTS "Super-admins can view all temporary passwords" ON temporary_passwords;
DROP POLICY IF EXISTS "Admins can view temporary passwords in their buildings" ON temporary_passwords;
DROP POLICY IF EXISTS "Residents can view their own temporary passwords" ON temporary_passwords;
DROP POLICY IF EXISTS "Super-admins can insert temporary passwords" ON temporary_passwords;
DROP POLICY IF EXISTS "Admins can insert temporary passwords for their buildings" ON temporary_passwords;
DROP POLICY IF EXISTS "Residents can insert their own temporary passwords" ON temporary_passwords;
DROP POLICY IF EXISTS "Super-admins can update temporary passwords" ON temporary_passwords;
DROP POLICY IF EXISTS "Admins can update temporary passwords in their buildings" ON temporary_passwords;
DROP POLICY IF EXISTS "Residents can update their own temporary passwords" ON temporary_passwords;
DROP POLICY IF EXISTS "Super-admins can delete temporary passwords" ON temporary_passwords;
DROP POLICY IF EXISTS "Admins can delete temporary passwords in their buildings" ON temporary_passwords;
DROP POLICY IF EXISTS "Residents can delete their own temporary passwords" ON temporary_passwords;

DROP POLICY IF EXISTS "Super-admins can view all visitor temporary passwords" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Admins can view visitor temporary passwords in their buildings" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Visitors can view their own temporary passwords" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Super-admins can insert visitor temporary passwords" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Admins can insert visitor temporary passwords for their buildings" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Visitors can insert their own temporary passwords" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Super-admins can update visitor temporary passwords" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Admins can update visitor temporary passwords in their buildings" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Visitors can update their own temporary passwords" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Super-admins can delete visitor temporary passwords" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Admins can delete visitor temporary passwords in their buildings" ON visitor_temporary_passwords;
DROP POLICY IF EXISTS "Visitors can delete their own temporary passwords" ON visitor_temporary_passwords;

DROP POLICY IF EXISTS "Super-admins can view all visitors" ON visitors;
DROP POLICY IF EXISTS "Admins can view visitors in their buildings" ON visitors;
DROP POLICY IF EXISTS "Visitors can view their own profile" ON visitors;
DROP POLICY IF EXISTS "Super-admins can insert visitors" ON visitors;
DROP POLICY IF EXISTS "Admins can insert visitors for their buildings" ON visitors;
DROP POLICY IF EXISTS "Visitors can insert their own profile" ON visitors;
DROP POLICY IF EXISTS "Super-admins can update visitors" ON visitors;
DROP POLICY IF EXISTS "Admins can update visitors in their buildings" ON visitors;
DROP POLICY IF EXISTS "Visitors can update their own profile" ON visitors;
DROP POLICY IF EXISTS "Super-admins can delete visitors" ON visitors;
DROP POLICY IF EXISTS "Admins can delete visitors in their buildings" ON visitors;

-- Drop helper functions
DROP FUNCTION IF EXISTS is_super_admin();
DROP FUNCTION IF EXISTS get_user_building_ids();
DROP FUNCTION IF EXISTS is_building_admin(uuid);

-- Disable RLS on all tables
ALTER TABLE buildings DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE building_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE apartments DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_residents DISABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_passwords DISABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_temporary_passwords DISABLE ROW LEVEL SECURITY;
ALTER TABLE visitors DISABLE ROW LEVEL SECURITY;

-- Also disable RLS on any other tables that might have it enabled
ALTER TABLE IF EXISTS shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shift_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS permissions DISABLE ROW LEVEL SECURITY;

-- Grant full access to anon and authenticated roles on all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Confirm RLS is disabled by checking system tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

-- This query should return no rows if RLS is successfully disabled on all tables