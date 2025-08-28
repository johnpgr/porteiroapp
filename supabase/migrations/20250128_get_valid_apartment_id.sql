-- Obter um apartmentId válido para testes
SELECT 
    'Apartamento válido para teste:' as debug_info,
    id as apartment_id,
    number,
    building_id
FROM apartments 
ORDER BY created_at ASC
LIMIT 1;

-- Verificar se há apartamentos disponíveis
SELECT 
    'Total de apartamentos:' as debug_info,
    COUNT(*) as total_apartments
FROM apartments;

-- Listar alguns apartamentos para referência
SELECT 
    'Apartamentos disponíveis:' as debug_info,
    id,
    number,
    building_id
FROM apartments 
ORDER BY number
LIMIT 5;