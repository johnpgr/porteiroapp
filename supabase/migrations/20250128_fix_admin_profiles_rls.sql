-- Migration: Fix admin_profiles table RLS policies for login
-- Ensure admin_profiles has proper RLS policies for authentication

-- 1. Check current RLS status for admin_profiles
SELECT 
    'BEFORE MIGRATION - admin_profiles RLS STATUS:' as status,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'admin_profiles' AND schemaname = 'public';

-- 2. Check existing policies for admin_profiles
SELECT 
    'BEFORE MIGRATION - admin_profiles POLICIES:' as status,
    schemaname, 
    tablename, 
    policyname, 
    cmd
FROM pg_policies 
WHERE tablename = 'admin_profiles' 
ORDER BY policyname;

-- 3. Drop existing restrictive policies that might block login
DROP POLICY IF EXISTS "Users can view own admin profile" ON public.admin_profiles;
DROP POLICY IF EXISTS "Users can update own admin profile" ON public.admin_profiles;
DROP POLICY IF EXISTS "Users can insert own admin profile" ON public.admin_profiles;

-- 4. Create comprehensive RLS policies for admin_profiles
-- Allow users to view their own admin profile
CREATE POLICY "Users can view own admin profile" ON public.admin_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to update their own admin profile
CREATE POLICY "Users can update own admin profile" ON public.admin_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to insert their own admin profile during registration
CREATE POLICY "Users can insert own admin profile" ON public.admin_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to view admin profiles (needed for system functionality)
CREATE POLICY "Authenticated users can view admin profiles" ON public.admin_profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow service role full access (needed for system operations)
CREATE POLICY "Service role full access admin profiles" ON public.admin_profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.admin_profiles TO anon;
GRANT ALL PRIVILEGES ON public.admin_profiles TO authenticated;
GRANT ALL PRIVILEGES ON public.admin_profiles TO service_role;

-- 6. Verify the policies were created
SELECT 
    'AFTER MIGRATION - admin_profiles POLICIES:' as status,
    schemaname, 
    tablename, 
    policyname, 
    cmd
FROM pg_policies 
WHERE tablename = 'admin_profiles' 
ORDER BY policyname;

-- 7. Test basic access to both tables
SELECT 
    'TESTING ACCESS:' as status,
    'profiles' as table_name,
    COUNT(*) as record_count
FROM public.profiles
UNION ALL
SELECT 
    'TESTING ACCESS:' as status,
    'admin_profiles' as table_name,
    COUNT(*) as record_count
FROM public.admin_profiles;

SELECT 'Admin profiles RLS policies fixed successfully!' as final_status;