-- Criar admin padrão para testes com UUID gerado automaticamente
-- Remove admin de teste anterior se existir
DELETE FROM admin_profiles WHERE email = 'admin-test@porteiroapp.com';
DELETE FROM auth.users WHERE email = 'admin-test@porteiroapp.com';

-- Inserir usuário na tabela auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  email_change_token_new,
  recovery_token
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin-test@porteiroapp.com',
  crypt('admin123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  '',
  '',
  ''
);

-- Inserir admin_profile usando o user_id do usuário criado
INSERT INTO admin_profiles (
  id,
  user_id,
  full_name,
  email,
  role,
  is_active,
  created_at,
  updated_at
) 
SELECT 
  gen_random_uuid(),
  u.id,
  'Admin Teste',
  'admin-test@porteiroapp.com',
  'admin',
  true,
  now(),
  now()
FROM auth.users u 
WHERE u.email = 'admin-test@porteiroapp.com';

-- Comentário para identificar o propósito
COMMENT ON TABLE admin_profiles IS 'Perfis dos administradores do sistema. Inclui admin padrão para testes.';