-- Migration: Insert admin without buildings and create test buildings
-- Created: 2024
-- Description: Inserts 'sindicosempredio@dev.com' admin without building assignments,
--              creates test buildings and apartments, and assigns buildings to 'douglas@dev.com'

-- 1. Insert admin profile for 'sindicosempredio@dev.com' without building assignments
INSERT INTO admin_profiles (user_id, full_name, email, role)
VALUES (
  '9b4787a4-5460-47e1-bcec-7a81e44002cb',
  'Síndico Sem Prédio',
  'sindicosempredio@dev.com',
  'admin'
);

-- 2. Create test buildings
INSERT INTO buildings (name, address)
VALUES 
  (
    'Edifício Residencial Jardim das Flores',
    'Rua das Flores, 123 - São Paulo, SP, CEP: 01234-567'
  ),
  (
    'Condomínio Vila Bela Vista',
    'Avenida Bela Vista, 456 - Rio de Janeiro, RJ, CEP: 20000-000'
  ),
  (
    'Residencial Parque das Árvores',
    'Rua das Árvores, 789 - Belo Horizonte, MG, CEP: 30000-000'
  );

-- 3. Create apartments for each building (5 apartments per building)
-- Get building IDs for apartment creation
WITH building_ids AS (
  SELECT id, name FROM buildings 
  WHERE name IN (
    'Edifício Residencial Jardim das Flores',
    'Condomínio Vila Bela Vista', 
    'Residencial Parque das Árvores'
  )
)
INSERT INTO apartments (building_id, number, floor)
SELECT 
  b.id,
  apt.number,
  apt.floor
FROM building_ids b
CROSS JOIN (
  VALUES 
    ('101', 1),
    ('201', 2),
    ('301', 3),
    ('401', 4),
    ('501', 5)
) AS apt(number, floor);

-- 4. Assign ONLY the buildings to 'douglas@dev.com' admin
-- Find douglas@dev.com admin profile ID and assign buildings
WITH douglas_admin AS (
  SELECT id FROM admin_profiles WHERE email = 'douglas@dev.com'
),
test_buildings AS (
  SELECT id FROM buildings 
  WHERE name IN (
    'Edifício Residencial Jardim das Flores',
    'Condomínio Vila Bela Vista',
    'Residencial Parque das Árvores'
  )
)
INSERT INTO building_admins (building_id, admin_profile_id)
SELECT tb.id, da.id
FROM test_buildings tb
CROSS JOIN douglas_admin da;

-- Note: 'sindicosempredio@dev.com' admin is intentionally NOT assigned to any buildings
-- This allows testing the scenario of admins without building assignments