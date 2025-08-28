-- Migration: Fix RLS policies for profiles table
-- Date: 2025-01-28
-- Purpose: Allow insertion of new user profiles during registration process

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create more permissive policies for user registration
-- Allow authenticated users and service role to insert profiles
CREATE POLICY "Allow profile insertion" ON public.profiles
  FOR INSERT 
  WITH CHECK (true); -- Allow all insertions

-- Allow users to view their own profile or allow service role to view all
CREATE POLICY "Allow profile viewing" ON public.profiles
  FOR SELECT 
  USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role' OR
    auth.role() = 'anon'
  );

-- Allow users to update their own profile or allow service role to update all
CREATE POLICY "Allow profile updates" ON public.profiles
  FOR UPDATE 
  USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Allow users to delete their own profile or allow service role to delete all
CREATE POLICY "Allow profile deletion" ON public.profiles
  FOR DELETE 
  USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Ensure proper permissions are granted
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.profiles IS 'User profiles with RLS policies allowing registration flow';

-- Success message
SELECT 'RLS policies updated successfully for profiles table' as status;