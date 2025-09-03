-- Fix permissions for porteiro_shifts table
-- Grant necessary permissions to anon and authenticated roles

-- Grant SELECT permission to anon role (for reading shifts)
GRANT SELECT ON porteiro_shifts TO anon;

-- Grant full permissions to authenticated role (for CRUD operations)
GRANT ALL PRIVILEGES ON porteiro_shifts TO authenticated;

-- Verify current permissions
SELECT 
  grantee, 
  table_name, 
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'porteiro_shifts' 
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;