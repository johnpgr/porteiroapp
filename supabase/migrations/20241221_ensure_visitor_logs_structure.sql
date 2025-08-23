-- Migração para garantir que a tabela visitor_logs tenha a estrutura correta
-- Adiciona campos que podem estar faltando na tabela visitor_logs

-- Verificar se a coluna building_id existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visitor_logs' AND column_name = 'building_id') THEN
        ALTER TABLE visitor_logs ADD COLUMN building_id UUID REFERENCES buildings(id);
    END IF;
END $$;

-- Verificar se a coluna log_time existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visitor_logs' AND column_name = 'log_time') THEN
        ALTER TABLE visitor_logs ADD COLUMN log_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Verificar se a coluna tipo_log existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visitor_logs' AND column_name = 'tipo_log') THEN
        ALTER TABLE visitor_logs ADD COLUMN tipo_log VARCHAR(10) CHECK (tipo_log IN ('IN', 'OUT'));
    END IF;
END $$;

-- Verificar se a coluna visit_session_id existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visitor_logs' AND column_name = 'visit_session_id') THEN
        ALTER TABLE visitor_logs ADD COLUMN visit_session_id VARCHAR(255);
    END IF;
END $$;

-- Verificar se a coluna purpose existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visitor_logs' AND column_name = 'purpose') THEN
        ALTER TABLE visitor_logs ADD COLUMN purpose TEXT;
    END IF;
END $$;

-- Verificar se a coluna status existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visitor_logs' AND column_name = 'status') THEN
        ALTER TABLE visitor_logs ADD COLUMN status VARCHAR(50);
    END IF;
END $$;

-- Remover colunas antigas se existirem
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'visitor_logs' AND column_name = 'entry_time') THEN
        ALTER TABLE visitor_logs DROP COLUMN entry_time;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'visitor_logs' AND column_name = 'exit_time') THEN
        ALTER TABLE visitor_logs DROP COLUMN exit_time;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'visitor_logs' AND column_name = 'notes') THEN
        ALTER TABLE visitor_logs DROP COLUMN notes;
    END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_visitor_logs_visitor_id ON visitor_logs(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_apartment_id ON visitor_logs(apartment_id);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_building_id ON visitor_logs(building_id);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_log_time ON visitor_logs(log_time);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_tipo_log ON visitor_logs(tipo_log);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_visit_session_id ON visitor_logs(visit_session_id);

-- Garantir que RLS está habilitado
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;

-- Verificar e criar políticas RLS se não existirem
DO $$
BEGIN
    -- Política para SELECT
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'visitor_logs' AND policyname = 'visitor_logs_select_policy') THEN
        CREATE POLICY visitor_logs_select_policy ON visitor_logs
            FOR SELECT USING (true);
    END IF;
    
    -- Política para INSERT
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'visitor_logs' AND policyname = 'visitor_logs_insert_policy') THEN
        CREATE POLICY visitor_logs_insert_policy ON visitor_logs
            FOR INSERT WITH CHECK (true);
    END IF;
    
    -- Política para UPDATE
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'visitor_logs' AND policyname = 'visitor_logs_update_policy') THEN
        CREATE POLICY visitor_logs_update_policy ON visitor_logs
            FOR UPDATE USING (true);
    END IF;
    
    -- Política para DELETE
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'visitor_logs' AND policyname = 'visitor_logs_delete_policy') THEN
        CREATE POLICY visitor_logs_delete_policy ON visitor_logs
            FOR DELETE USING (true);
    END IF;
END $$;

-- Garantir permissões para as roles
GRANT ALL PRIVILEGES ON visitor_logs TO authenticated;
GRANT SELECT ON visitor_logs TO anon;

-- Comentário da migração
COMMENT ON TABLE visitor_logs IS 'Tabela de logs de visitantes com estrutura atualizada - migração 20241221_ensure_visitor_logs_structure';