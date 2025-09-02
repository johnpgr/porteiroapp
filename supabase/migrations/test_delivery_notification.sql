-- Teste de notificação em tempo real para entregas
-- Este arquivo será usado para testar se as notificações estão funcionando

-- Primeiro, vamos buscar um building_id e apartment_id válidos
-- Substitua pelos IDs corretos do seu ambiente

-- Inserir uma entrega de teste
INSERT INTO deliveries (
  apartment_id,
  building_id,
  recipient_name,
  sender_company,
  tracking_code,
  delivery_company,
  description,
  status,
  notification_status
) VALUES (
  -- Substitua por um apartment_id válido
  (SELECT id FROM apartments LIMIT 1),
  -- Substitua por um building_id válido
  (SELECT building_id FROM apartments LIMIT 1),
  'João Silva',
  'Amazon',
  'AMZ123456789',
  'Correios',
  'Pacote pequeno - Eletrônicos',
  'pending',
  'pending'
);

-- Aguardar um momento e depois atualizar o status para testar notificação de mudança
-- UPDATE deliveries 
-- SET status = 'delivered', notification_status = 'delivered'
-- WHERE recipient_name = 'João Silva' AND sender_company = 'Amazon';