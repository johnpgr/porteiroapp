-- Buscar o visitante de teste criado
WITH test_visitor AS (
  SELECT id FROM visitors WHERE name = 'João Silva Teste' LIMIT 1
),
-- Buscar um apartamento e building
apartment_info AS (
  SELECT a.id as apartment_id, a.building_id 
  FROM apartments a 
  LIMIT 1
)
-- Criar log para associar visitante ao apartamento
INSERT INTO visitor_logs (
  visitor_id,
  apartment_id,
  building_id,
  log_time,
  tipo_log,
  visit_session_id,
  purpose,
  status
)
SELECT 
  tv.id,
  ai.apartment_id,
  ai.building_id,
  NOW(),
  'IN',
  gen_random_uuid(),
  'Teste de visitante aprovado',
  'approved'
FROM test_visitor tv, apartment_info ai;

-- Verificar se foi criado
SELECT 
  vl.*,
  v.name as visitor_name,
  v.status as visitor_status,
  a.number as apartment_number
FROM visitor_logs vl
JOIN visitors v ON vl.visitor_id = v.id
JOIN apartments a ON vl.apartment_id = a.id
WHERE v.name = 'João Silva Teste';