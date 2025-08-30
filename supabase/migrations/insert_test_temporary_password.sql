-- Inserir o registro de teste baseado nos dados do CSV
INSERT INTO temporary_passwords (
    id,
    profile_id,
    password_hash,
    plain_password,
    used,
    created_at,
    expires_at,
    phone_number
) VALUES (
    'ab20dd5e-3aa0-4a89-8375-fdcd7e80100e',
    '63b8c4d6-f527-48e1-ab68-f1483b5f476d',
    '548bc0fb5249a731c32b56dbb3dcff6b1862bbf6e8b06132290ce2c727c9b3ce',
    '616255',
    false,
    '2025-08-30 13:45:43.472133+00',
    '2025-09-06 13:45:43.341+00',
    '+5591981941219'
)
ON CONFLICT (id) DO UPDATE SET
    profile_id = EXCLUDED.profile_id,
    password_hash = EXCLUDED.password_hash,
    plain_password = EXCLUDED.plain_password,
    used = EXCLUDED.used,
    created_at = EXCLUDED.created_at,
    expires_at = EXCLUDED.expires_at,
    phone_number = EXCLUDED.phone_number;

-- Verificar se o registro foi inserido
SELECT * FROM temporary_passwords WHERE profile_id = '63b8c4d6-f527-48e1-ab68-f1483b5f476d';

-- Verificar se o profile existe na tabela profiles
SELECT id, phone FROM profiles WHERE id = '63b8c4d6-f527-48e1-ab68-f1483b5f476d';