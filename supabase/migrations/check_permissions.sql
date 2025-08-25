-- Check current permissions for anon and authenticated roles
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND grantee IN ('anon', 'authenticated') 
  AND table_name IN ('visitors', 'visitor_logs', 'apartments', 'apartment_residents', 'profiles')
ORDER BY table_name, grantee;

-- Grant necessary permissions if they don't exist
-- For visitors table
GRANT SELECT, INSERT, UPDATE ON visitors TO authenticated;
GRANT SELECT ON visitors TO anon;

-- For visitor_logs table
GRANT SELECT, INSERT, UPDATE ON visitor_logs TO authenticated;
GRANT SELECT ON visitor_logs TO anon;

-- For apartments table
GRANT SELECT ON apartments TO authenticated;
GRANT SELECT ON apartments TO anon;

-- For apartment_residents table
GRANT SELECT ON apartment_residents TO authenticated;
GRANT SELECT ON apartment_residents TO anon;

-- For profiles table
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

-- Check permissions again after granting
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND grantee IN ('anon', 'authenticated') 
  AND table_name IN ('visitors', 'visitor_logs', 'apartments', 'apartment_residents', 'profiles')
ORDER BY table_name, grantee;