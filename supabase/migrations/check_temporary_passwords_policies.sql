-- Verificar políticas RLS da tabela temporary_passwords
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'temporary_passwords';

-- Verificar permissões da tabela temporary_passwords
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'temporary_passwords' 
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- Verificar se RLS está habilitado
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'temporary_passwords';