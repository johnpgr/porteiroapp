-- Grant explicit permissions for porteiro_shifts table
-- This ensures anon and authenticated roles can access the table

-- First, ensure the table exists and check current state
DO $$
BEGIN
    -- Grant SELECT to anon role
    EXECUTE 'GRANT SELECT ON TABLE public.porteiro_shifts TO anon';
    RAISE NOTICE 'Granted SELECT permission to anon role';
    
    -- Grant all privileges to authenticated role
    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE public.porteiro_shifts TO authenticated';
    RAISE NOTICE 'Granted ALL PRIVILEGES to authenticated role';
    
    -- Also grant usage on the sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_schema = 'public' AND sequence_name LIKE '%porteiro_shifts%') THEN
        EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon';
        EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated';
        RAISE NOTICE 'Granted sequence permissions';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error granting permissions: %', SQLERRM;
END
$$;

-- Verify the permissions were granted
SELECT 
    'Permissions for porteiro_shifts:' as info;
    
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'porteiro_shifts' 
    AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;