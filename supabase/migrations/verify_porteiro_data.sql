-- Script para verificar dados do porteiro dougladmo19@gmail.com
-- e identificar problemas no registro de visitantes

-- 1. Verificar perfil do porteiro
SELECT 
    id,
    email,
    full_name,
    role,
    building_id,
    created_at
FROM profiles 
WHERE email = 'dougladmo19@gmail.com';

-- 2. Verificar prédio vinculado ao porteiro
SELECT 
    b.id as building_id,
    b.name as building_name,
    b.address,
    b.created_at,
    p.email as porteiro_email,
    p.full_name as porteiro_name
FROM buildings b
JOIN profiles p ON p.building_id = b.id
WHERE p.email = 'dougladmo19@gmail.com';

-- 3. Listar todos os apartamentos do prédio do porteiro
SELECT 
    a.id as apartment_id,
    a.number as apartment_number,
    a.floor,
    a.building_id,
    b.name as building_name,
    a.created_at
FROM apartments a
JOIN buildings b ON a.building_id = b.id
JOIN profiles p ON p.building_id = b.id
WHERE p.email = 'dougladmo19@gmail.com'
ORDER BY a.number;

-- 4. Verificar especificamente o apartamento 101
SELECT 
    a.id as apartment_id,
    a.number as apartment_number,
    a.floor,
    a.building_id,
    b.name as building_name,
    a.created_at,
    'APARTAMENTO 101 ENCONTRADO' as status
FROM apartments a
JOIN buildings b ON a.building_id = b.id
JOIN profiles p ON p.building_id = b.id
WHERE p.email = 'dougladmo19@gmail.com'
AND a.number = '101';

-- 5. Verificar se há apartamentos com números diferentes de string
SELECT 
    a.id,
    a.number,
    a.floor,
    a.building_id,
    LENGTH(a.number) as number_length,
    CASE 
        WHEN a.number ~ '^[0-9]+$' THEN 'NUMERIC'
        ELSE 'NON_NUMERIC'
    END as number_type
FROM apartments a
JOIN profiles p ON p.building_id = a.building_id
WHERE p.email = 'dougladmo19@gmail.com'
ORDER BY a.number;

-- 6. Verificar logs de visitantes para apartamento 101
SELECT 
    vl.id,
    vl.visitor_id,
    vl.apartment_id,
    vl.building_id,
    vl.log_time,
    vl.tipo_log,
    vl.purpose,
    a.number as apartment_number,
    v.name as visitor_name
FROM visitor_logs vl
JOIN apartments a ON vl.apartment_id = a.id
JOIN visitors v ON vl.visitor_id = v.id
JOIN profiles p ON p.building_id = vl.building_id
WHERE p.email = 'dougladmo19@gmail.com'
AND a.number = '101'
ORDER BY vl.log_time DESC
LIMIT 10;

-- 7. Verificar se há inconsistências nos building_ids
SELECT 
    'PROFILE' as table_name,
    building_id,
    COUNT(*) as count
FROM profiles 
WHERE email = 'dougladmo19@gmail.com'
GROUP BY building_id

UNION ALL

SELECT 
    'APARTMENTS' as table_name,
    a.building_id,
    COUNT(*) as count
FROM apartments a
JOIN profiles p ON p.building_id = a.building_id
WHERE p.email = 'dougladmo19@gmail.com'
GROUP BY a.building_id;

-- 8. Verificar permissões nas tabelas
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name IN ('apartments', 'buildings', 'profiles', 'visitors', 'visitor_logs')
AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;