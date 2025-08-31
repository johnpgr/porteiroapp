-- Verificar se os dados de teste foram inseridos corretamente
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
WHERE visitor_name = 'João Teste' AND visitor_phone = '91981941219'
ORDER BY created_at DESC;