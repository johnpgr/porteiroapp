-- Verificar políticas RLS da tabela profiles
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
WHERE tablename = 'profiles' AND schemaname = 'public';

-- Verificar se RLS está habilitado na tabela profiles
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- Verificar permissões da tabela profiles
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee;