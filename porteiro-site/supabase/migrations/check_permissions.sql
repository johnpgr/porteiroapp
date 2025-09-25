-- Verificar permissões da tabela super_admin_profiles
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'super_admin_profiles' 
  AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- Verificar se existem políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'super_admin_profiles';

-- Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity, forcerowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'super_admin_profiles