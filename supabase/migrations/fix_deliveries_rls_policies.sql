-- Fix RLS policies for deliveries table to allow porters to insert deliveries
-- Drop existing policies first
DROP POLICY IF EXISTS "deliveries_select_policy" ON deliveries;
DROP POLICY IF EXISTS "deliveries_insert_policy" ON deliveries;
DROP POLICY IF EXISTS "deliveries_update_policy" ON deliveries;
DROP POLICY IF EXISTS "deliveries_delete_policy" ON deliveries;

-- Ensure RLS is enabled
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Grant basic permissions to authenticated users
GRANT SELECT ON deliveries TO authenticated;
GRANT INSERT ON deliveries TO authenticated;
GRANT UPDATE ON deliveries TO authenticated;
GRANT DELETE ON deliveries TO authenticated;

-- Create new RLS policies
-- Allow all authenticated users to read deliveries
CREATE POLICY "deliveries_select_policy" ON deliveries
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow porters and admins to insert deliveries
CREATE POLICY "deliveries_insert_policy" ON deliveries
    FOR INSERT
    TO authenticated
    WITH CHECK (
        is_current_user_admin_or_porteiro() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.user_type IN ('porteiro', 'admin')
        )
    );

-- Allow porters and admins to update deliveries
CREATE POLICY "deliveries_update_policy" ON deliveries
    FOR UPDATE
    TO authenticated
    USING (
        is_current_user_admin_or_porteiro() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.user_type IN ('porteiro', 'admin')
        )
    )
    WITH CHECK (
        is_current_user_admin_or_porteiro() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.user_type IN ('porteiro', 'admin')
        )
    );

-- Allow only admins to delete deliveries
CREATE POLICY "deliveries_delete_policy" ON deliveries
    FOR DELETE
    TO authenticated
    USING (
        is_current_user_admin() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.user_type = 'admin'
        )
    );

-- Test the policies with some debug queries
-- Check current user info
SELECT 
    auth.uid() as current_user_id,
    auth.email() as current_user_email;

-- Check current user profile
SELECT 
    id,
    full_name,
    user_type,
    role
FROM profiles 
WHERE id = auth.uid();

-- Test the functions
SELECT 
    is_current_user_porteiro() as is_porteiro,
    is_current_user_admin() as is_admin,
    is_current_user_admin_or_porteiro() as is_admin_or_porteiro;

-- Check if user can insert into deliveries (this should return true for porters)
SELECT 
    CASE 
        WHEN is_current_user_admin_or_porteiro() THEN 'Can insert via function'
        WHEN EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.user_type IN ('porteiro', 'admin')
        ) THEN 'Can insert via profile check'
        ELSE 'Cannot insert'
    END as insert_permission;