-- Query para verificar visitantes com status 'approved'
SELECT 
    id,
    name,
    document,
    status,
    visitor_type,
    created_at
FROM visitors 
WHERE status = 'aprovado'
ORDER BY created_at DESC;

-- Contar visitantes por status
SELECT 
    status,
    COUNT(*) as total
FROM visitors 
GROUP BY status
ORDER BY status;