-- Script para verificar status existentes na tabela visitor_logs
-- Executar antes de aplicar a nova constraint

-- Verificar todos os status únicos existentes
SELECT DISTINCT status, COUNT(*) as count
FROM visitor_logs 
GROUP BY status
ORDER BY status;

-- Verificar se há valores NULL
SELECT COUNT(*) as null_count
FROM visitor_logs 
WHERE status IS NULL;

-- Mostrar alguns exemplos de registros
SELECT id, visitor_id, status, tipo_log, log_time
FROM visitor_logs 
ORDER BY log_time DESC
LIMIT 10;