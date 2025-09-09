-- Debug: Verificar se existe perfil para o user_id específico
SELECT 
  id,
  user_id,
  full_name,
  cpf,
  first_login_completed,
  profile_completion_date,
  photo_verification_status,
  created_at
FROM profiles 
WHERE user_id = 'b977e3bd-8e64-445f-8826-41917926d5e6';

-- Verificar todos os perfis para debug
SELECT 
  id,
  user_id,
  full_name,
  cpf,
  first_login_completed,
  created_at
FROM profiles 
ORDER BY created_at DESC
LIMIT 10;

-- Verificar se há usuários na tabela auth.users
SELECT 
  id,
  email,
  created_at
FROM auth.users 
WHERE id = 'b977e3bd-8e64-445f-8826-41917926d5e6';