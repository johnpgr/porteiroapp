-- Limpeza final de tokens com entity_id inválidos
-- Esta migração remove todos os tokens que não possuem entity_id válido como UUID

-- 1. Verificar tokens com entity_id problemáticos
SELECT 
    'Tokens com entity_id inválidos:' as debug_info,
    COUNT(*) as count
FROM registration_tokens 
WHERE entity_id::text ~ '^[a-zA-Z]' -- Começa com letra (não é UUID)
   OR entity_id::text LIKE '%test%'
   OR entity_id::text LIKE '%apartment%';

-- 2. Listar os tokens problemáticos antes de deletar
SELECT 
    'Tokens que serão removidos:' as debug_info,
    id,
    token,
    entity_id,
    entity_type,
    token_type,
    created_at
FROM registration_tokens 
WHERE entity_id::text ~ '^[a-zA-Z]' -- Começa com letra (não é UUID)
   OR entity_id::text LIKE '%test%'
   OR entity_id::text LIKE '%apartment%'
ORDER BY created_at DESC;

-- 3. Deletar tokens com entity_id inválidos
DELETE FROM registration_tokens 
WHERE entity_id::text ~ '^[a-zA-Z]' -- Começa com letra (não é UUID)
   OR entity_id::text LIKE '%test%'
   OR entity_id::text LIKE '%apartment%';

-- 4. Verificar se a limpeza foi bem-sucedida
SELECT 
    'Tokens restantes após limpeza:' as debug_info,
    COUNT(*) as total_tokens
FROM registration_tokens;

-- 5. Listar os 5 tokens mais recentes para verificação
SELECT 
    'Últimos 5 tokens válidos:' as debug_info,
    id,
    entity_id,
    entity_type,
    token_type,
    created_at
FROM registration_tokens 
ORDER BY created_at DESC
LIMIT 5;