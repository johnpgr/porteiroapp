-- Verificar os dados inseridos na tabela visitor_logs
-- Consulta para ver todos os logs inseridos com informações detalhadas

SELECT 
    vl.id,
    v.name as visitor_name,
    v.document,
    v.phone,
    b.name as building_name,
    a.number as apartment_number,
    vl.purpose,
    vl.status,
    vl.entry_time,
    vl.exit_time,
    p.email as authorized_by_email,
    vl.created_at,
    -- Verificar se o prédio é gerenciado pelo admin@dev.com
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM building_admins ba 
            JOIN admin_profiles ap ON ba.admin_profile_id = ap.id 
            WHERE ba.building_id = vl.building_id 
            AND ap.email = 'admin@dev.com'
        ) THEN 'GERENCIADO pelo admin@dev.com'
        ELSE 'NÃO GERENCIADO pelo admin@dev.com'
    END as management_status
FROM visitor_logs vl
JOIN visitors v ON vl.visitor_id = v.id
JOIN buildings b ON vl.building_id = b.id
JOIN apartments a ON vl.apartment_id = a.id
LEFT JOIN profiles p ON vl.authorized_by = p.id
ORDER BY vl.created_at DESC;

-- Consulta específica para logs que devem aparecer para admin@dev.com
SELECT 
    'LOGS VISÍVEIS PARA admin@dev.com' as section,
    COUNT(*) as total_logs
FROM visitor_logs vl
JOIN building_admins ba ON vl.building_id = ba.building_id
JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
WHERE ap.email = 'admin@dev.com';

-- Consulta para logs que NÃO devem aparecer para admin@dev.com
SELECT 
    'LOGS NÃO VISÍVEIS PARA admin@dev.com' as section,
    COUNT(*) as total_logs
FROM visitor_logs vl
WHERE vl.building_id NOT IN (
    SELECT ba.building_id 
    FROM building_admins ba
    JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
    WHERE ap.email = 'admin@dev.com'
);