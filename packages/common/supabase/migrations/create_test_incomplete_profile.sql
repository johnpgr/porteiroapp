-- Criar perfil de teste incompleto para testar página de completar cadastro
-- Este perfil terá profile_complete = false e uma senha temporária válida

-- Inserir perfil incompleto
INSERT INTO profiles (
  id,
  full_name,
  email,
  phone,
  cpf,
  profile_complete,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'João Silva Teste',
  'joao.teste@example.com',
  '(11) 99999-9999',
  '123.456.789-00',
  false,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  cpf = EXCLUDED.cpf,
  profile_complete = EXCLUDED.profile_complete,
  updated_at = NOW();

-- Inserir senha temporária para este perfil
INSERT INTO temporary_passwords (
  id,
  profile_id,
  phone_number,
  password_hash,
  plain_password,
  used,
  expires_at,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000',
  '(11) 99999-9999',
  crypt('123456', gen_salt('bf')),
  '123456',
  false,
  NOW() + INTERVAL '24 hours',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  phone_number = EXCLUDED.phone_number,
  password_hash = crypt('123456', gen_salt('bf')),
  plain_password = EXCLUDED.plain_password,
  used = false,
  expires_at = NOW() + INTERVAL '24 hours',
  created_at = NOW();

-- Verificar se os dados foram inseridos corretamente
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.profile_complete,
  tp.plain_password,
  tp.used,
  tp.expires_at
FROM profiles p
LEFT JOIN temporary_passwords tp ON p.id = tp.profile_id
WHERE p.id = '550e8400-e29b-41d4-a716-446655440000';