-- Debug: Verificar se existe apartamento com ID 'test-apartment'
SELECT 
    'Apartamentos com ID test-apartment:' as debug_info,
    COUNT(*) as count
FROM apartments 
WHERE id::text = 'test-apartment';

-- Listar todos os apartamentos para debug
SELECT 
    'Todos os apartamentos:' as debug_info,
    id,
    number,
    building_id,
    created_at
FROM apartments 
ORDER BY created_at DESC
LIMIT 10;

-- Verificar se há algum apartamento com ID que não seja UUID válido
SELECT 
    'Apartamentos com ID inválido:' as debug_info,
    id,
    number
FROM apartments 
WHERE id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Verificar tokens de registro existentes
SELECT 
    'Tokens de registro existentes:' as debug_info,
    entity_id,
    entity_type,
    token_type,
    created_at
FROM registration_tokens 
ORDER BY created_at DESC
LIMIT 5;