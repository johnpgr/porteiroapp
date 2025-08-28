-- Consultar dados atuais para debug

-- 1. Verificar apartamentos existentes
SELECT 
    'Apartamentos existentes:' as info,
    id,
    number,
    building_id,
    created_at
FROM apartments 
ORDER BY created_at DESC
LIMIT 10;

-- 2. Verificar se existe apartamento com ID 'test-apartment'
SELECT 
    'Apartamentos com ID test-apartment:' as info,
    COUNT(*) as count
FROM apartments 
WHERE id::text = 'test-apartment';

-- 3. Verificar tokens de registro existentes
SELECT 
    'Tokens de registro existentes:' as info,
    id,
    entity_id,
    entity_type,
    token_type,
    is_used,
    created_at
FROM registration_tokens 
ORDER BY created_at DESC
LIMIT 10;

-- 4. Verificar tokens com entity_id 'test-apartment'
SELECT 
    'Tokens com entity_id test-apartment:' as info,
    COUNT(*) as count
FROM registration_tokens 
WHERE entity_id::text = 'test-apartment';

-- 5. Verificar se há apartamentos com IDs inválidos (não UUID)
SELECT 
    'Apartamentos com ID inválido:' as info,
    id,
    number
FROM apartments 
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';