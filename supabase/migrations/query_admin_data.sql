-- Consulta para identificar prédios gerenciados pelo admin@dev.com
SELECT 
    ap.id as admin_profile_id, 
    ap.email, 
    ap.role, 
    ba.building_id, 
    b.name as building_name,
    b.id as building_uuid
FROM admin_profiles ap 
LEFT JOIN building_admins ba ON ap.id = ba.admin_profile_id 
LEFT JOIN buildings b ON ba.building_id = b.id 
WHERE ap.email = 'admin@dev.com';

-- Buscar todos os prédios para identificar os que NÃO são gerenciados
SELECT id, name FROM buildings;

-- Buscar apartamentos dos prédios gerenciados
SELECT a.id, a.number, a.building_id, b.name as building_name
FROM apartments a
JOIN buildings b ON a.building_id = b.id
JOIN building_admins ba ON b.id = ba.building_id
JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
WHERE ap.email = 'admin@dev.com';

-- Buscar apartamentos de prédios NÃO gerenciados
SELECT a.id, a.number, a.building_id, b.name as building_name
FROM apartments a
JOIN buildings b ON a.building_id = b.id
WHERE b.id NOT IN (
    SELECT ba.building_id 
    FROM building_admins ba
    JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
    WHERE ap.email = 'admin@dev.com'
);

-- Buscar visitantes existentes
SELECT id, name, document, phone FROM visitors LIMIT 10;