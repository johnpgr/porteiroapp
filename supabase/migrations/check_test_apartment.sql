-- Listar todos os apartamentos para debug
SELECT id, number, building_id FROM apartments ORDER BY number;

-- Contar total de apartamentos
SELECT COUNT(*) as total_apartments FROM apartments;