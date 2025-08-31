-- Inserir novo registro de teste na tabela visitor_temporary_passwords
DELETE FROM visitor_temporary_passwords WHERE visitor_name = 'João Teste' AND visitor_phone = '91981941219';

INSERT INTO visitor_temporary_passwords (
  visitor_name,
  visitor_phone,
  plain_password,
  hashed_password,
  status,
  used,
  created_at,
  expires_at
) VALUES (
  'João Teste',
  '91981941219',
  '123456',
  '$2b$10$abcdefghijklmnopqrstuvwxyz123456789',
  'active',
  false,
  NOW(),
  NOW() + INTERVAL '24 hours'
);