-- Adicionar campos para sistema de agendamento de visitação
-- Data: 2025-01-27
-- Descrição: Adiciona campos para controle de visitação pontual e frequente

-- Primeiro, criar o tipo ENUM para visit_type se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_type_enum') THEN
        CREATE TYPE visit_type_enum AS ENUM ('pontual', 'frequente');
    END IF;
END $$;

-- Adicionar colunas à tabela visitors
ALTER TABLE visitors 
ADD COLUMN IF NOT EXISTS visit_type visit_type_enum DEFAULT 'pontual',
ADD COLUMN IF NOT EXISTS visit_date DATE,
ADD COLUMN IF NOT EXISTS visit_start_time TIME,
ADD COLUMN IF NOT EXISTS visit_end_time TIME,
ADD COLUMN IF NOT EXISTS allowed_days TEXT[],
ADD COLUMN IF NOT EXISTS max_simultaneous_visits INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

-- Criar índices para otimizar consultas de agendamento
CREATE INDEX IF NOT EXISTS idx_visitors_visit_type ON visitors(visit_type);
CREATE INDEX IF NOT EXISTS idx_visitors_visit_date ON visitors(visit_date);
CREATE INDEX IF NOT EXISTS idx_visitors_apartment_visit_date ON visitors(apartment_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_visitors_allowed_days ON visitors USING GIN(allowed_days);

-- Adicionar comentários para documentação
COMMENT ON COLUMN visitors.visit_type IS 'Tipo de visitação: pontual (data específica) ou frequente (dias recorrentes)';
COMMENT ON COLUMN visitors.visit_date IS 'Data específica para visitas pontuais';
COMMENT ON COLUMN visitors.visit_start_time IS 'Horário de início permitido para a visita';
COMMENT ON COLUMN visitors.visit_end_time IS 'Horário de fim permitido para a visita';
COMMENT ON COLUMN visitors.allowed_days IS 'Dias da semana permitidos para visitas frequentes (monday, tuesday, etc.)';
COMMENT ON COLUMN visitors.max_simultaneous_visits IS 'Número máximo de visitas simultâneas permitidas';
COMMENT ON COLUMN visitors.is_recurring IS 'Indica se a visita é recorrente (para visitas frequentes)';

-- Função para validar conflitos de agendamento (modificada para permitir múltiplas visitas no mesmo horário)
CREATE OR REPLACE FUNCTION check_visit_scheduling_conflicts()
RETURNS TRIGGER AS $$
BEGIN
    -- Removidas as validações de conflito de horário conforme solicitado
    -- Múltiplas visitas podem ocorrer no mesmo horário
    
    -- Apenas retorna NEW sem validações de conflito
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validação de conflitos
DROP TRIGGER IF EXISTS trigger_check_visit_conflicts ON visitors;
CREATE TRIGGER trigger_check_visit_conflicts
    BEFORE INSERT OR UPDATE ON visitors
    FOR EACH ROW
    EXECUTE FUNCTION check_visit_scheduling_conflicts();

-- Função para verificar disponibilidade de horários
CREATE OR REPLACE FUNCTION check_visit_availability(
    p_apartment_id UUID,
    p_visit_date DATE DEFAULT NULL,
    p_visit_day TEXT DEFAULT NULL,
    p_start_time TIME DEFAULT NULL,
    p_end_time TIME DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER := 0;
BEGIN
    -- Verificar conflitos com visitas pontuais
    IF p_visit_date IS NOT NULL THEN
        SELECT COUNT(*) INTO conflict_count
        FROM visitors v
        WHERE v.apartment_id = p_apartment_id
          AND v.visit_type = 'pontual'
          AND v.visit_date = p_visit_date
          AND (
              (p_start_time BETWEEN v.visit_start_time AND v.visit_end_time)
              OR (p_end_time BETWEEN v.visit_start_time AND v.visit_end_time)
              OR (v.visit_start_time BETWEEN p_start_time AND p_end_time)
          );
    END IF;
    
    -- Verificar conflitos com visitas frequentes
    IF p_visit_day IS NOT NULL THEN
        SELECT COUNT(*) INTO conflict_count
        FROM visitors v
        WHERE v.apartment_id = p_apartment_id
          AND v.visit_type = 'frequente'
          AND p_visit_day = ANY(v.allowed_days)
          AND (
              (p_start_time BETWEEN v.visit_start_time AND v.visit_end_time)
              OR (p_end_time BETWEEN v.visit_start_time AND v.visit_end_time)
              OR (v.visit_start_time BETWEEN p_start_time AND p_end_time)
          );
    END IF;
    
    RETURN conflict_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Conceder permissões necessárias
GRANT EXECUTE ON FUNCTION check_visit_availability TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_visit_scheduling_conflicts TO authenticated, anon;

-- Atualizar políticas RLS se necessário (manter as existentes)
-- As políticas RLS existentes já cobrem a tabela visitors