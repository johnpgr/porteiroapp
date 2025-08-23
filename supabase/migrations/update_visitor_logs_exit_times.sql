-- Atualizar alguns registros existentes para adicionar exit_time realista
-- Atualizar registros mais antigos para ter exit_time
UPDATE visitor_logs 
SET 
  exit_time = entry_time + INTERVAL '2 hours',
  status = 'completed'
WHERE exit_time IS NULL 
  AND entry_time < NOW() - INTERVAL '3 hours'
  AND purpose LIKE '%Entrega%';

UPDATE visitor_logs 
SET 
  exit_time = entry_time + INTERVAL '1 hour 30 minutes',
  status = 'completed'
WHERE exit_time IS NULL 
  AND entry_time < NOW() - INTERVAL '2 hours'
  AND purpose LIKE '%Visita%';

UPDATE visitor_logs 
SET 
  exit_time = entry_time + INTERVAL '45 minutes',
  status = 'completed'
WHERE exit_time IS NULL 
  AND entry_time < NOW() - INTERVAL '1 hour'
  AND purpose LIKE '%Manutenção%';

-- Inserir novos registros com diferentes cenários
-- Visitantes que já saíram (com exit_time)
INSERT INTO visitor_logs (
  visitor_id, apartment_id, building_id, entry_time, exit_time, purpose, status, authorized_by
) 
SELECT 
  v.id as visitor_id,
  a.id as apartment_id,
  a.building_id,
  NOW() - INTERVAL '4 hours' as entry_time,
  NOW() - INTERVAL '2 hours' as exit_time,
  'Entrega de encomenda' as purpose,
  'completed' as status,
  p.id as authorized_by
FROM visitors v
CROSS JOIN apartments a
CROSS JOIN profiles p
WHERE v.name = 'João Silva'
  AND a.number = '101'
  AND p.email = 'admin@dev.com'
LIMIT 1;

INSERT INTO visitor_logs (
  visitor_id, apartment_id, building_id, entry_time, exit_time, purpose, status
) 
SELECT 
  v.id as visitor_id,
  a.id as apartment_id,
  a.building_id,
  NOW() - INTERVAL '6 hours' as entry_time,
  NOW() - INTERVAL '5 hours 15 minutes' as exit_time,
  'Visita social' as purpose,
  'completed' as status
FROM visitors v
CROSS JOIN apartments a
WHERE v.name = 'Maria Santos'
  AND a.number = '102'
LIMIT 1;

INSERT INTO visitor_logs (
  visitor_id, apartment_id, building_id, entry_time, exit_time, purpose, status, authorized_by
) 
SELECT 
  v.id as visitor_id,
  a.id as apartment_id,
  a.building_id,
  NOW() - INTERVAL '8 hours' as entry_time,
  NOW() - INTERVAL '6 hours 45 minutes' as exit_time,
  'Manutenção' as purpose,
  'completed' as status,
  p.id as authorized_by
FROM visitors v
CROSS JOIN apartments a
CROSS JOIN profiles p
WHERE v.name = 'Carlos Oliveira'
  AND a.number = '201'
  AND p.email = 'admin@dev.com'
LIMIT 1;

-- Visitantes ainda no prédio (exit_time NULL)
INSERT INTO visitor_logs (
  visitor_id, apartment_id, building_id, entry_time, purpose, status, authorized_by
) 
SELECT 
  v.id as visitor_id,
  a.id as apartment_id,
  a.building_id,
  NOW() - INTERVAL '30 minutes' as entry_time,
  'Entrega de medicamentos' as purpose,
  'approved' as status,
  p.id as authorized_by
FROM visitors v
CROSS JOIN apartments a
CROSS JOIN profiles p
WHERE v.name = 'João Silva'
  AND a.number = '301'
  AND p.email = 'admin@dev.com'
LIMIT 1;

INSERT INTO visitor_logs (
  visitor_id, apartment_id, building_id, entry_time, purpose, status
) 
SELECT 
  v.id as visitor_id,
  a.id as apartment_id,
  a.building_id,
  NOW() - INTERVAL '1 hour 15 minutes' as entry_time,
  'Visita familiar' as purpose,
  'approved' as status
FROM visitors v
CROSS JOIN apartments a
WHERE v.name = 'Maria Santos'
  AND a.number = '302'
LIMIT 1;

INSERT INTO visitor_logs (
  visitor_id, apartment_id, building_id, entry_time, purpose, status
) 
SELECT 
  v.id as visitor_id,
  a.id as apartment_id,
  a.building_id,
  NOW() - INTERVAL '20 minutes' as entry_time,
  'Entrega de compras' as purpose,
  'pending' as status
FROM visitors v
CROSS JOIN apartments a
WHERE v.name = 'Carlos Oliveira'
  AND a.number = '101'
LIMIT 1;

-- Adicionar mais registros com diferentes horários para demonstrar saídas
INSERT INTO visitor_logs (
  visitor_id, apartment_id, building_id, entry_time, exit_time, purpose, status
) 
SELECT 
  v.id as visitor_id,
  a.id as apartment_id,
  a.building_id,
  NOW() - INTERVAL '3 days' as entry_time,
  NOW() - INTERVAL '3 days' + INTERVAL '1 hour 30 minutes' as exit_time,
  'Visita médica' as purpose,
  'completed' as status
FROM visitors v
CROSS JOIN apartments a
WHERE v.name = 'Ana Costa'
  AND a.number = '202'
LIMIT 1;

INSERT INTO visitor_logs (
  visitor_id, apartment_id, building_id, entry_time, exit_time, purpose, status, authorized_by
) 
SELECT 
  v.id as visitor_id,
  a.id as apartment_id,
  a.building_id,
  NOW() - INTERVAL '2 days' as entry_time,
  NOW() - INTERVAL '2 days' + INTERVAL '3 hours' as exit_time,
  'Reunião de trabalho' as purpose,
  'completed' as status,
  p.id as authorized_by
FROM visitors v
CROSS JOIN apartments a
CROSS JOIN profiles p
WHERE v.name = 'Pedro Lima'
  AND a.number = '303'
  AND p.email = 'admin@dev.com'
LIMIT 1;