-- Verificar apartamentos com IDs problemáticos
-- Esta migração é apenas para depuração

-- 1. Listar todos os apartamentos
SELECT 'Total de apartamentos:' as info, COUNT(*) as count FROM apartments;

-- 2. Listar os primeiros 10 apartamentos com seus IDs
SELECT 'Primeiros 10 apartamentos:' as info;
SELECT id, number, building_id, created_at 
FROM apartments 
ORDER BY created_at 
LIMIT 10;

-- 3. Verificar se há algum apartamento com ID que contenha 'test'
SELECT 'Apartamentos com "test" no ID:' as info;
SELECT id, number, building_id 
FROM apartments 
WHERE id::text ILIKE '%test%';

-- 4. Verificar se há algum apartamento com número que contenha 'test'
SELECT 'Apartamentos com "test" no número:' as info;
SELECT id, number, building_id 
FROM apartments 
WHERE number ILIKE '%test%';

-- 5. Listar apartamentos mais recentes
SELECT 'Apartamentos mais recentes:' as info;
SELECT id, number, building_id, created_at 
FROM apartments 
ORDER BY created_at DESC 
LIMIT 5;