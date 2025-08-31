-- Verificar políticas RLS da tabela deliveries
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'deliveries';

-- Verificar permissões da tabela deliveries
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'deliveries' 
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;