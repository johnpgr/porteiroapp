-- Debug: Verificar se as funções estão funcionando corretamente

-- 1. Verificar o usuário atual
SELECT 
  auth.uid() as current_user_id,
  auth.email() as current_user_email;

-- 2. Verificar perfil do usuário atual na tabela profiles
SELECT 
  id,
  user_id,
  full_name,
  email,
  user_type,
  role
FROM profiles 
WHERE id = auth.uid() OR user_id = auth.uid();

-- 3. Verificar perfil do usuário atual na tabela admin_profiles
SELECT 
  id,
  user_id,
  full_name,
  email,
  role,
  is_active
FROM admin_profiles 
WHERE id = auth.uid() OR user_id = auth.uid();

-- 4. Testar as funções
SELECT 
  is_current_user_porteiro() as is_porteiro,
  is_current_user_admin() as is_admin,
  is_current_user_admin_or_porteiro() as is_admin_or_porteiro;

-- 5. Verificar políticas RLS da tabela deliveries
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
WHERE tablename = 'deliveries';