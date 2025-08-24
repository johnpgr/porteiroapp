-- Correção final para o campo tipo_log na tabela visitor_logs
-- Garantir que o campo tenha tamanho suficiente e não cause erro "value too long for type character varying(3)"

-- Verificar e alterar o tipo do campo tipo_log se necessário
DO $$
BEGIN
    -- Alterar o tipo do campo tipo_log para VARCHAR(10) se ainda estiver como VARCHAR(3)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'visitor_logs' 
        AND column_name = 'tipo_log' 
        AND character_maximum_length = 3
    ) THEN
        -- Remover a constraint CHECK existente
        ALTER TABLE visitor_logs DROP CONSTRAINT IF EXISTS visitor_logs_tipo_log_check;
        
        -- Alterar o tipo da coluna
        ALTER TABLE visitor_logs ALTER COLUMN tipo_log TYPE VARCHAR(10);
        
        -- Recriar a constraint CHECK
        ALTER TABLE visitor_logs ADD CONSTRAINT visitor_logs_tipo_log_check 
            CHECK (tipo_log IN ('IN', 'OUT'));
            
        -- Atualizar o comentário
        COMMENT ON COLUMN visitor_logs.tipo_log IS 'Tipo de registro: IN para entrada, OUT para saída - VARCHAR(10) para compatibilidade';
        
        RAISE NOTICE 'Campo tipo_log alterado de VARCHAR(3) para VARCHAR(10) com sucesso';
    ELSE
        RAISE NOTICE 'Campo tipo_log já está com tamanho adequado';
    END IF;
END $$;

-- Verificar se o campo visit_session_id está como UUID (deve estar correto)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'visitor_logs' 
        AND column_name = 'visit_session_id' 
        AND data_type = 'uuid'
    ) THEN
        RAISE EXCEPTION 'Campo visit_session_id não está como UUID. Verificar migrações anteriores.';
    ELSE
        RAISE NOTICE 'Campo visit_session_id está correto como UUID';
    END IF;
END $$;

-- Garantir que as permissões estejam corretas
GRANT SELECT, INSERT, UPDATE ON visitor_logs TO authenticated;
GRANT SELECT ON visitor_logs TO anon;

-- Verificar a estrutura final
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'visitor_logs' 
AND column_name IN ('tipo_log', 'visit_session_id')
ORDER BY column_name;