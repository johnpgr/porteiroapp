-- Teste de inserção manual para validar permissões
-- Primeiro, vamos inserir um visitante de teste
INSERT INTO visitors (name, document, phone, visitor_type, status)
VALUES ('Teste Visitante', '12345678901', '11999999999', 'comum', 'aprovado');

-- Obter o ID do visitante inserido
SELECT id, name, document FROM visitors WHERE name = 'Teste Visitante';

-- Agora vamos testar inserção no visitor_logs
-- Primeiro precisamos de um apartment_id válido
SELECT id, number FROM apartments LIMIT 1;

-- Inserir um log de teste (usando IDs reais do sistema)
INSERT INTO visitor_logs (
    visitor_id,
    apartment_id,
    building_id,
    tipo_log,
    visit_session_id,
    purpose,
    status,
    auto_approved,
    requires_resident_approval
)
SELECT 
    v.id as visitor_id,
    a.id as apartment_id,
    a.building_id,
    'IN' as tipo_log,
    gen_random_uuid() as visit_session_id,
    'Teste de inserção' as purpose,
    'approved' as status,
    true as auto_approved,
    false as requires_resident_approval
FROM visitors v, apartments a 
WHERE v.name = 'Teste Visitante'
LIMIT 1;

-- Verificar se a inserção funcionou
SELECT 
    vl.id,
    v.name as visitor_name,
    a.number as apartment_number,
    vl.tipo_log,
    vl.status,
    vl.auto_approved,
    vl.created_at
FROM visitor_logs vl
JOIN visitors v ON vl.visitor_id = v.id
JOIN apartments a ON vl.apartment_id = a.id
WHERE v.name = 'Teste Visitante';

-- Limpar dados de teste
DELETE FROM visitor_logs WHERE visitor_id IN (SELECT id FROM visitors WHERE name = 'Teste Visitante');
DELETE FROM visitors WHERE name = 'Teste Visitante';