-- Verificar e corrigir permissões para a tabela admin_profiles
-- Este script garante que os roles anon e authenticated possam acessar a tabela

-- Verificar se o registro foi inserido
SELECT 
  id,
  user_id,
  full_name,
  email,
  role,
  is_active,
  created_at
FROM admin_profiles;

-- Conceder permissões para o role anon (necessário para consultas não autenticadas)
GRANT SELECT ON admin_profiles TO anon;

-- Conceder permissões completas para o role authenticated
GRANT ALL PRIVILEGES ON admin_profiles TO authenticated;

-- Verificar as permissões atuais
SELECT 
  grantee, 
  table_name, 
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'admin_profiles'
  AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- Criar política RLS para permitir que administradores vejam seus próprios perfis
CREATE POLICY "Admins can view their own profile" ON admin_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Criar política RLS para permitir consultas anônimas (necessário para login)
CREATE POLICY "Allow anonymous read for login" ON admin_profiles
  FOR SELECT
  USING (true);

-- Verificar as políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'admin_profiles';