-- Verificar dados na tabela visitor_temporary_passwords
SELECT 
  id,
  visitor_name,
  visitor_phone,
  plain_password,
  status,
  used,
  created_at,
  expires_at
FROM visitor_temporary_passwords
WHERE status = 'active'
ORDER BY created_at DESC;