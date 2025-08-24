-- Migração para corrigir o tamanho do campo tipo_log na tabela visitor_logs
-- Data: 2024-12-25
-- Descrição: Altera o campo tipo_log de VARCHAR(3) para VARCHAR(10) para evitar erros de 'value too long'

-- Remover a constraint CHECK existente se houver
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name LIKE '%tipo_log%' AND table_name = 'visitor_logs') THEN
        ALTER TABLE visitor_logs DROP CONSTRAINT IF EXISTS visitor_logs_tipo_log_check;
    END IF;
END $$;

-- Alterar o tipo da coluna tipo_log para VARCHAR(10)
ALTER TABLE visitor_logs ALTER COLUMN tipo_log TYPE VARCHAR(10);

-- Recriar a constraint CHECK com o novo tamanho
ALTER TABLE visitor_logs ADD CONSTRAINT visitor_logs_tipo_log_check 
    CHECK (tipo_log IN ('IN', 'OUT'));

-- Comentário da migração
COMMENT ON COLUMN visitor_logs.tipo_log IS 'Tipo de registro: IN para entrada, OUT para saída - VARCHAR(10) para compatibilidade';