-- Verificar se há dados sendo inseridos nas tabelas visitors e visitor_logs
-- após as correções implementadas

-- Verificar visitantes recentes (últimos 10 minutos)
SELECT 
  'visitors' as table_name,
  COUNT(*) as recent_records,
  MAX(created_at) as last_insert
FROM visitors 
WHERE created_at >= NOW() - INTERVAL '10 minutes'

UNION ALL

-- Verificar logs de visitantes recentes (últimos 10 minutos)
SELECT 
  'visitor_logs' as table_name,
  COUNT(*) as recent_records,
  MAX(created_at) as last_insert
FROM visitor_logs 
WHERE created_at >= NOW() - INTERVAL '10 minutes';

-- Verificar últimos 5 registros de cada tabela
SELECT 'ÚLTIMOS VISITANTES:' as info;
SELECT id, name, document, phone, created_at 
FROM visitors 
ORDER BY created_at DESC 
LIMIT 5;

SELECT 'ÚLTIMOS LOGS:' as info;
SELECT id, visitor_id, apartment_id, building_id, status, created_at 
FROM visitor_logs 
ORDER BY created_at DESC 
LIMIT 5;

-- Verificar se há apartment_residents configurados
SELECT 'APARTMENT_RESIDENTS:' as info;
SELECT ar.id, ar.apartment_id, p.email, p.user_type
FROM apartment_residents ar
JOIN profiles p ON ar.profile_id = p.id
ORDER BY ar.created_at DESC
LIMIT 5;