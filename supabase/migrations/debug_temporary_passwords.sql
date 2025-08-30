-- Debug: Verificar dados na tabela temporary_passwords

-- 1. Contar total de registros na tabela
SELECT COUNT(*) as total_records FROM temporary_passwords;

-- 2. Mostrar todos os registros (limitado a 10)
SELECT 
    id,
    profile_id,
    phone_number,
    plain_password,
    used,
    expires_at,
    created_at
FROM temporary_passwords 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Buscar especificamente pelo profile_id em questão
SELECT 
    id,
    profile_id,
    phone_number,
    plain_password,
    used,
    expires_at,
    created_at,
    CASE 
        WHEN expires_at > NOW() THEN 'Válida'
        ELSE 'Expirada'
    END as status_expiracao
FROM temporary_passwords 
WHERE profile_id = '63b8c4d6-f527-48e1-ab68-f1483b5f476d';

-- 4. Verificar se existe algum registro com telefone similar
SELECT 
    id,
    profile_id,
    phone_number,
    plain_password,
    used,
    expires_at,
    created_at
FROM temporary_passwords 
WHERE phone_number LIKE '%91981941219%' 
   OR phone_number LIKE '%91%98194%1219%'
   OR phone_number LIKE '%(91)%98194-1219%';

-- 5. Verificar registros não utilizados e não expirados
SELECT 
    id,
    profile_id,
    phone_number,
    plain_password,
    used,
    expires_at,
    created_at
FROM temporary_passwords 
WHERE used = false 
  AND expires_at > NOW()
ORDER BY created_at DESC;