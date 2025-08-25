-- Verificar permissões aplicadas
SELECT 
    'visitors' as table_name,
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'visitors'
    AND grantee IN ('anon', 'authenticated')
UNION ALL
SELECT 
    'visitor_logs' as table_name,
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'visitor_logs'
    AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- Verificar políticas RLS
SELECT 
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('visitors', 'visitor_logs')
ORDER BY tablename, policyname;