-- Limpar tokens com entity_id inválido
-- Primeiro, vamos verificar se há tokens problemáticos

SELECT 
    'Tokens com entity_id problemático:' as debug_info,
    id,
    entity_id,
    entity_type,
    token_type,
    metadata,
    created_at
FROM registration_tokens 
WHERE entity_id::text = 'test-apartment' 
   OR entity_id::text LIKE '%test-apartment%'
ORDER BY created_at DESC;

-- Verificar todos os tokens existentes
SELECT 
    'Todos os tokens existentes:' as debug_info,
    id,
    entity_id,
    entity_type,
    token_type,
    is_used,
    created_at
FROM registration_tokens 
ORDER BY created_at DESC
LIMIT 10;

-- Deletar tokens com entity_id inválido (se existirem)
DELETE FROM registration_tokens 
WHERE entity_id::text = 'test-apartment' 
   OR entity_id::text LIKE '%test-apartment%';

-- Verificar se há tokens com entity_id que não são UUIDs válidos
SELECT 
    'Tokens com entity_id inválido:' as debug_info,
    id,
    entity_id,
    entity_type
FROM registration_tokens 
WHERE entity_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';