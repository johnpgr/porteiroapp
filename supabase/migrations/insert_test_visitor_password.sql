-- Inserir dados de teste na tabela visitor_temporary_passwords para teste do endpoint
-- Primeiro, deletar registros existentes para o mesmo visitante
DELETE FROM visitor_temporary_passwords 
WHERE visitor_name = 'Teste Usuario' AND visitor_phone = '91981941219';

-- Inserir novo registro de teste
INSERT INTO visitor_temporary_passwords (
    visitor_name,
    visitor_phone,
    plain_password,
    hashed_password,
    status,
    used,
    created_at,
    expires_at
) VALUES (
    'Teste Usuario',
    '91981941219',
    '123456',
    'hashed_123456',
    'active',
    false,
    NOW(),
    NOW() + INTERVAL '7 days'
);