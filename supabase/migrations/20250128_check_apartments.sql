-- Consulta para verificar apartamentos existentes
SELECT id, number, building_id 
FROM apartments 
ORDER BY created_at DESC 
LIMIT 20;

-- Verificar se existe apartamento com ID 'test-apartment'
SELECT COUNT(*) as count_test_apartment
FROM apartments 
WHERE id::text = 'test-apartment';

-- Verificar apartamentos com IDs que não são UUIDs válidos
SELECT id, number
FROM apartments 
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';