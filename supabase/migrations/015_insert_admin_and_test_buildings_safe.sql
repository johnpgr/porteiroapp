-- Migração para inserir administrador sem prédios e criar prédios de teste
-- Versão segura que verifica existência antes de inserir

-- 1. Inserir administrador 'sindicosempredio@dev.com' sem prédios vinculados (apenas se não existir)
INSERT INTO admin_profiles (user_id, full_name, email, role, is_active)
SELECT 
    '9b4787a4-5460-47e1-bcec-7a81e44002cb'::uuid,
    'Síndico Sem Prédio',
    'sindicosempredio@dev.com',
    'admin',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE user_id = '9b4787a4-5460-47e1-bcec-7a81e44002cb'::uuid
);

-- 2. Criar 3 prédios de teste (apenas se não existirem)
INSERT INTO buildings (name, address)
SELECT * FROM (
    VALUES 
        ('Edifício Teste A', 'Rua das Flores, 123 - São Paulo, SP'),
        ('Edifício Teste B', 'Av. Central, 456 - Rio de Janeiro, RJ'),
        ('Edifício Teste C', 'Rua do Comércio, 789 - Belo Horizonte, MG')
) AS new_buildings(name, address)
WHERE NOT EXISTS (
    SELECT 1 FROM buildings 
    WHERE name = new_buildings.name
);

-- 3. Criar apartamentos para cada prédio (5 apartamentos por prédio)
-- Apartamentos para Edifício Teste A
INSERT INTO apartments (building_id, number, floor)
SELECT 
    b.id,
    apt.number,
    apt.floor
FROM buildings b
CROSS JOIN (
    VALUES 
        ('101', 1),
        ('102', 1),
        ('201', 2),
        ('202', 2),
        ('301', 3)
) AS apt(number, floor)
WHERE b.name = 'Edifício Teste A'
AND NOT EXISTS (
    SELECT 1 FROM apartments a 
    WHERE a.building_id = b.id AND a.number = apt.number
);

-- Apartamentos para Edifício Teste B
INSERT INTO apartments (building_id, number, floor)
SELECT 
    b.id,
    apt.number,
    apt.floor
FROM buildings b
CROSS JOIN (
    VALUES 
        ('101', 1),
        ('102', 1),
        ('201', 2),
        ('301', 3),
        ('401', 4)
) AS apt(number, floor)
WHERE b.name = 'Edifício Teste B'
AND NOT EXISTS (
    SELECT 1 FROM apartments a 
    WHERE a.building_id = b.id AND a.number = apt.number
);

-- Apartamentos para Edifício Teste C
INSERT INTO apartments (building_id, number, floor)
SELECT 
    b.id,
    apt.number,
    apt.floor
FROM buildings b
CROSS JOIN (
    VALUES 
        ('101', 1),
        ('201', 2),
        ('301', 3),
        ('401', 4),
        ('501', 5)
) AS apt(number, floor)
WHERE b.name = 'Edifício Teste C'
AND NOT EXISTS (
    SELECT 1 FROM apartments a 
    WHERE a.building_id = b.id AND a.number = apt.number
);

-- 4. Vincular APENAS os prédios ao administrador 'douglas@dev.com'
-- Primeiro, buscar o admin_profile_id do douglas@dev.com
INSERT INTO building_admins (building_id, admin_profile_id)
SELECT 
    b.id,
    ap.id
FROM buildings b
CROSS JOIN admin_profiles ap
WHERE b.name IN ('Edifício Teste A', 'Edifício Teste B', 'Edifício Teste C')
AND ap.email = 'douglas@dev.com'
AND NOT EXISTS (
    SELECT 1 FROM building_admins ba 
    WHERE ba.building_id = b.id AND ba.admin_profile_id = ap.id
);

-- Comentário: O administrador 'sindicosempredio@dev.com' NÃO será vinculado a nenhum prédio
-- Isso demonstra a funcionalidade de administradores sem prédios vinculados