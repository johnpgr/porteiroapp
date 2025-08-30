-- Verificar todos os registros na tabela temporary_passwords
SELECT 
    id,
    profile_id,
    phone_number,
    plain_password,
    used,
    created_at,
    expires_at,
    CASE 
        WHEN expires_at > NOW() THEN 'Válido'
        ELSE 'Expirado'
    END as status_expiracao
FROM temporary_passwords
ORDER BY created_at DESC;

-- Verificar especificamente o registro do profile_id em questão
SELECT 
    'Registro específico' as tipo,
    id,
    profile_id,
    phone_number,
    plain_password,
    used,
    expires_at,
    expires_at > NOW() as ainda_valido
FROM temporary_passwords
WHERE profile_id = '63b8c4d6-f527-48e1-ab68-f1483b5f476d';

-- Contar total de registros
SELECT COUNT(*) as total_registros FROM temporary_passwords;

-- Verificar registros não utilizados e não expirados
SELECT 
    COUNT(*) as registros_validos,
    'Registros não utilizados e não expirados' as descricao
FROM temporary_passwords
WHERE used = false AND expires_at > NOW();

-- Verificar se existe o profile_id na tabela profiles
SELECT 
    'Verificação profile' as tipo,
    id,
    phone,
    created_at
FROM profiles
WHERE id = '63b8c4d6-f527-48e1-ab68-f1483b5f476d';