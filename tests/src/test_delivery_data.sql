-- Script para inserir dados de teste de entrega
-- Execute este script no Supabase SQL Editor para criar dados de teste

-- Primeiro, vamos verificar se existe um apartamento para testar
SELECT id, number, building_id FROM apartments LIMIT 1;

-- Inserir um log de entrega de teste
-- Substitua os valores de apartment_id e building_id pelos valores reais do seu banco
INSERT INTO visitor_logs (
  id,
  visitor_id,
  apartment_id,
  building_id,
  log_time,
  tipo_log,
  entry_type,
  notification_status,
  requires_resident_approval,
  notification_sent_at,
  expires_at,
  purpose,
  guest_name,
  delivery_sender,
  delivery_description,
  created_at
) VALUES (
  gen_random_uuid(),
  NULL, -- Entregas não precisam de visitor_id
  (SELECT id FROM apartments LIMIT 1), -- Pega o primeiro apartamento
  (SELECT building_id FROM apartments LIMIT 1), -- Pega o building_id do primeiro apartamento
  NOW(),
  'IN',
  'delivery', -- Este é o campo crucial para detecção de entregas
  'pending',
  true,
  NOW(),
  NOW() + INTERVAL '30 minutes',
  'Entrega de teste - Amazon',
  'Entrega Amazon',
  'Amazon',
  'Pacote de teste para verificar notificações de entrega',
  NOW()
);

-- Verificar se o registro foi inserido corretamente
SELECT 
  id,
  entry_type,
  notification_status,
  guest_name,
  delivery_sender,
  delivery_description,
  purpose,
  apartment_id
FROM visitor_logs 
WHERE entry_type = 'delivery' 
ORDER BY created_at DESC 
LIMIT 5;