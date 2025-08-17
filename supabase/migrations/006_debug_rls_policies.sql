-- Debug RLS policies for users table
-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'users';

-- Check if anon role has access to users table
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'users' 
AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- Test query to see if we can access users data
SELECT email, user_type, is_active 
FROM users 
WHERE email = 'admin@teste.com';

-- Create or update RLS policy to allow authentication
DROP POLICY IF EXISTS "Allow authentication access" ON users;

CREATE POLICY "Allow authentication access" ON users
FOR SELECT
TO anon, authenticated
USING (true);

-- Grant necessary permissions to anon role for authentication
GRANT SELECT ON users TO anon;
GRANT SELECT ON users TO authenticated;

-- Verify the fix
SELECT email, user_type, is_active 
FROM users 
WHERE email = 'admin@teste.com';