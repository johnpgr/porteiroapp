-- Verificar se existe perfil para o user_id específico dos logs
SELECT 
  id,
  user_id,
  full_name,
  email,
  cpf,
  first_login_completed,
  profile_completion_date,
  created_at
FROM profiles 
WHERE user_id = 'b977e3bd-8e64-445f-8826-41917926d5e6';

-- Verificar se o usuário existe na tabela auth.users
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users 
WHERE id = 'b977e3bd-8e64-445f-8826-41917926d5e6';

-- Contar total de perfis na tabela
SELECT COUNT(*) as total_profiles FROM profiles;

-- Listar alguns perfis para comparação
SELECT 
  id,
  user_id,
  full_name,
  cpf,
  first_login_completed
FROM profiles 
ORDER BY created_at DESC 
LIMIT 5;