-- Debug das políticas RLS
-- Verificar se as políticas foram criadas corretamente

-- 1. Verificar políticas existentes na tabela communications
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
WHERE tablename = 'communications';

-- 2. Verificar se a função is_admin_user existe e funciona
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'is_admin_user';

-- 3. Testar a função is_admin_user com um ID específico
-- (Substitua pelo ID do admin encontrado no teste)
SELECT is_admin_user('bb854522-0cc1-41f8-a629-63d098e95092') as is_admin;

-- 4. Verificar se RLS está habilitado na tabela communications
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'communications';

-- 5. Verificar permissões da role authenticated
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'communications'
    AND grantee = 'authenticated';