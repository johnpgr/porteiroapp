-- Inserir dados de teste para verificar o sistema de notificações
-- Este arquivo é apenas para teste e pode ser removido após a verificação

-- Primeiro, vamos buscar um apartment_id e building_id existentes
-- (substitua pelos IDs reais do seu banco)

-- Inserir um visitante de teste (se não existir)
INSERT INTO visitors (name, document, phone) 
SELECT 'João Silva', '12345678901', '11999999999'
WHERE NOT EXISTS (
    SELECT 1 FROM visitors WHERE document = '12345678901'
);

-- Inserir logs de visitante que devem aparecer como notificações pendentes
-- Substitua os UUIDs pelos valores reais do seu banco
INSERT INTO visitor_logs (
    visitor_id,
    apartment_id,
    building_id,
    entry_type,
    guest_name,
    notification_status,
    requires_resident_approval,
    expires_at,
    notification_sent_at,
    purpose,
    tipo_log
) VALUES (
    (SELECT id FROM visitors WHERE document = '12345678901' LIMIT 1),
    (SELECT id FROM apartments LIMIT 1), -- Substitua por um apartment_id real
    (SELECT id FROM buildings LIMIT 1),  -- Substitua por um building_id real
    'visitor',
    'João Silva',
    'pending',
    true,
    NOW() + INTERVAL '2 hours', -- Expira em 2 horas
    NOW(),
    'Visita social',
    'IN'
);

-- Inserir uma notificação de entrega
INSERT INTO visitor_logs (
    apartment_id,
    building_id,
    entry_type,
    guest_name,
    notification_status,
    requires_resident_approval,
    expires_at,
    notification_sent_at,
    delivery_sender,
    delivery_description,
    purpose,
    tipo_log
) VALUES (
    (SELECT id FROM apartments LIMIT 1), -- Substitua por um apartment_id real
    (SELECT id FROM buildings LIMIT 1),  -- Substitua por um building_id real
    'delivery',
    'Entregador Correios',
    'pending',
    true,
    NOW() + INTERVAL '1 hour', -- Expira em 1 hora
    NOW(),
    'Correios',
    'Encomenda registrada',
    'Entrega de encomenda',
    'IN'
);

-- Verificar se os dados foram inseridos corretamente
SELECT 
    id,
    entry_type,
    guest_name,
    notification_status,
    requires_resident_approval,
    expires_at,
    notification_sent_at,
    apartment_id
FROM visitor_logs 
WHERE notification_status = 'pending' 
  AND requires_resident_approval = true 
  AND expires_at > NOW()
ORDER BY notification_sent_at DESC;