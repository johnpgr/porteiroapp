-- Inserção direta dos prédios e apartamentos de teste
-- Script simplificado sem verificações condicionais

-- 1. Inserir prédios de teste
INSERT INTO buildings (id, name, address) VALUES 
('11111111-1111-1111-1111-111111111111', 'Edifício Teste A', 'Rua das Flores, 123 - São Paulo, SP'),
('22222222-2222-2222-2222-222222222222', 'Edifício Teste B', 'Av. Central, 456 - Rio de Janeiro, RJ'),
('33333333-3333-3333-3333-333333333333', 'Edifício Teste C', 'Rua do Comércio, 789 - Belo Horizonte, MG')
ON CONFLICT (id) DO NOTHING;

-- 2. Inserir apartamentos para Edifício Teste A
INSERT INTO apartments (building_id, number, floor) VALUES 
('11111111-1111-1111-1111-111111111111', '101', 1),
('11111111-1111-1111-1111-111111111111', '102', 1),
('11111111-1111-1111-1111-111111111111', '201', 2),
('11111111-1111-1111-1111-111111111111', '202', 2),
('11111111-1111-1111-1111-111111111111', '301', 3)
ON CONFLICT DO NOTHING;

-- 3. Inserir apartamentos para Edifício Teste B
INSERT INTO apartments (building_id, number, floor) VALUES 
('22222222-2222-2222-2222-222222222222', '101', 1),
('22222222-2222-2222-2222-222222222222', '102', 1),
('22222222-2222-2222-2222-222222222222', '201', 2),
('22222222-2222-2222-2222-222222222222', '301', 3),
('22222222-2222-2222-2222-222222222222', '401', 4)
ON CONFLICT DO NOTHING;

-- 4. Inserir apartamentos para Edifício Teste C
INSERT INTO apartments (building_id, number, floor) VALUES 
('33333333-3333-3333-3333-333333333333', '101', 1),
('33333333-3333-3333-3333-333333333333', '201', 2),
('33333333-3333-3333-3333-333333333333', '301', 3),
('33333333-3333-3333-3333-333333333333', '401', 4),
('33333333-3333-3333-3333-333333333333', '501', 5)
ON CONFLICT DO NOTHING;

-- 5. Vincular prédios ao Douglas Admin
-- Buscar o ID do Douglas e vincular aos 3 prédios
INSERT INTO building_admins (building_id, admin_profile_id)
SELECT 
    buildings.id,
    admin_profiles.id
FROM buildings, admin_profiles
WHERE buildings.name IN ('Edifício Teste A', 'Edifício Teste B', 'Edifício Teste C')
AND admin_profiles.email = 'douglas@dev.com'
ON CONFLICT DO NOTHING;

-- Verificar se os dados foram inseridos
SELECT 'Prédios criados:' as info, COUNT(*) as total FROM buildings WHERE name LIKE 'Edifício Teste%';
SELECT 'Apartamentos criados:' as info, COUNT(*) as total FROM apartments WHERE building_id IN (
    SELECT id FROM buildings WHERE name LIKE 'Edifício Teste%'
);
SELECT 'Vinculações criadas:' as info, COUNT(*) as total FROM building_admins ba
JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
WHERE ap.email = 'douglas@dev.com';