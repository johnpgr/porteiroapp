-- Teste da query exata usada no fetchVisitors
-- Query com inner join (como no código)
SELECT 
    v.*,
    a.number as apartment_number
FROM visitors v
INNER JOIN apartments a ON v.apartment_id = a.id
WHERE v.status = 'aprovado'
ORDER BY v.created_at DESC;

-- Query sem inner join para comparação
SELECT 
    v.*,
    a.number as apartment_number
FROM visitors v
LEFT JOIN apartments a ON v.apartment_id = a.id
WHERE v.status = 'aprovado'
ORDER BY v.created_at DESC;

-- Verificar se visitantes aprovados têm apartment_id
SELECT 
    id,
    name,
    status,
    apartment_id,
    CASE 
        WHEN apartment_id IS NULL THEN 'SEM APARTMENT_ID'
        ELSE 'COM APARTMENT_ID'
    END as apartment_status
FROM visitors 
WHERE status = 'aprovado';

-- Verificar se existem apartamentos na tabela
SELECT COUNT(*) as total_apartments FROM apartments;