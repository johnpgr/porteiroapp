-- Verificar se visitors tem apartment_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'visitors' AND table_schema = 'public';

-- Verificar visitantes aprovados sem apartment_id
SELECT id, name, status, visitor_type
FROM visitors 
WHERE status = 'aprovado';

-- Verificar se há visitor_logs com status approved
SELECT vl.*, v.name, v.status as visitor_status, a.number as apartment_number
FROM visitor_logs vl
JOIN visitors v ON vl.visitor_id = v.id
JOIN apartments a ON vl.apartment_id = a.id
WHERE vl.status = 'approved'
ORDER BY vl.created_at DESC;