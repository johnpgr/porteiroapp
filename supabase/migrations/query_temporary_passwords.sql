-- Consulta simples para ver todos os registros
SELECT * FROM temporary_passwords;

-- Consulta específica para o profile_id em questão
SELECT * FROM temporary_passwords WHERE profile_id = '63b8c4d6-f527-48e1-ab68-f1483b5f476d';

-- Verificar se o profile existe
SELECT id, phone FROM profiles WHERE id = '63b8c4d6-f527-48e1-ab68-f1483b5f476d';