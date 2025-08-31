-- Migration: Debug and fix profiles table RLS policies
-- The profiles table has RLS disabled which may be causing login issues

-- 1. Check current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- 2. Check existing policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY policyname;

-- 3. Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Allow profile insertion" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile viewing" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile updates" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile deletion" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view condominium profiles" ON public.profiles;
DROP POLICY IF EXISTS "Porteiros can view building profiles" ON public.profiles;

-- 5. Create comprehensive RLS policies for profiles
-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to insert their own profile during registration
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to view profiles (needed for admin/porteiro functionality)
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow service role full access (needed for system operations)
CREATE POLICY "Service role full access" ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon;
GRANT ALL PRIVILEGES ON public.profiles TO authenticated;
GRANT ALL PRIVILEGES ON public.profiles TO service_role;

-- 7. Verify the policies were created
SELECT 
    'AFTER MIGRATION - RLS POLICIES:' as status,
    schemaname, 
    tablename, 
    policyname, 
    cmd
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY policyname;

-- 8. Verify RLS is enabled
SELECT 
    'AFTER MIGRATION - RLS STATUS:' as status,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'profiles' AND schemaname = 'public';

SELECT 'Profiles RLS policies fixed successfully!' as final_status;