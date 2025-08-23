-- Criar um visitante aprovado para teste
INSERT INTO visitors (id, name, document, phone, status, visitor_type, is_active)
VALUES (
  gen_random_uuid(),
  'João Silva Teste',
  '12345678901',
  '11999999999',
  'aprovado',
  'comum',
  true
);

-- Buscar o ID do visitante criado
SELECT id, name, status FROM visitors WHERE name = 'João Silva Teste';

-- Buscar um apartamento para associar
SELECT id, number FROM apartments LIMIT 1;