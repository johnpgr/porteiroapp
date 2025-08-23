-- Migração corrigida para adicionar tipo de visitante e melhorar controle de status
-- Data: 2024-12-21
-- Descrição: Adiciona campo visitor_type na tabela visitors e melhora controle de status

-- 1. Primeiro, normalizar os status existentes na tabela visitor_logs
-- Mapear status existentes para os novos valores
UPDATE visitor_logs 
SET status = CASE 
    WHEN status = 'pending' THEN 'pending'
    WHEN status = 'approved' THEN 'approved' 
    WHEN status = 'denied' THEN 'denied'
    WHEN status = 'entered' THEN 'entered'
    WHEN status = 'exited' THEN 'exited'
    WHEN status = 'permanent' THEN 'permanent'
    WHEN status IS NULL THEN 'pending'
    ELSE 'pending'  -- Para qualquer outro valor não reconhecido
END;

-- 2. Adicionar campo visitor_type na tabela visitors
ALTER TABLE visitors 
ADD COLUMN IF NOT EXISTS visitor_type TEXT DEFAULT 'comum';

-- 3. Remover constraint existente se houver
ALTER TABLE visitor_logs DROP CONSTRAINT IF EXISTS visitor_logs_status_check;

-- 4. Adicionar nova constraint com os status válidos
ALTER TABLE visitor_logs 
ADD CONSTRAINT visitor_logs_status_check 
CHECK (status IN ('pending', 'approved', 'denied', 'entered', 'exited', 'permanent'));

-- 5. Adicionar constraint para visitor_type
ALTER TABLE visitors 
ADD CONSTRAINT visitors_type_check 
CHECK (visitor_type IN ('comum', 'frequente'));

-- 6. Comentários para os novos campos
COMMENT ON COLUMN visitors.visitor_type IS 'Tipo do visitante: comum (acesso único por autorização) ou frequente (acesso permanente)';
COMMENT ON COLUMN visitor_logs.status IS 'Status da visita: pending (aguardando), approved (aprovado), denied (negado), entered (entrou), exited (saiu), permanent (acesso permanente)';

-- 7. Atualizar visitantes existentes para tipo 'comum' se não especificado
UPDATE visitors 
SET visitor_type = 'comum' 
WHERE visitor_type IS NULL OR visitor_type = '';

-- 8. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_visitors_type ON visitors(visitor_type);
CREATE INDEX IF NOT EXISTS idx_visitors_document ON visitors(document);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_status ON visitor_logs(status);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_visitor_status ON visitor_logs(visitor_id, status);

-- 9. Função para controlar automaticamente o status após entrada
CREATE OR REPLACE FUNCTION control_visitor_status_after_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_visitor_type TEXT;
BEGIN
    -- Se é um registro de entrada (IN) e o status foi alterado para 'entered'
    IF NEW.tipo_log = 'IN' AND NEW.status = 'entered' THEN
        -- Verificar o tipo do visitante
        SELECT visitor_type INTO v_visitor_type 
        FROM visitors 
        WHERE id = NEW.visitor_id;
        
        -- Se é visitante comum, alterar status para pending
        -- Se é visitante frequente, manter status como permanent
        IF v_visitor_type = 'comum' THEN
            -- Atualizar outros logs do mesmo visitante para pending
            UPDATE visitor_logs 
            SET status = 'pending'
            WHERE visitor_id = NEW.visitor_id 
              AND id != NEW.id
              AND status IN ('approved', 'permanent');
              
            -- Atualizar status do visitante na tabela visitors
            UPDATE visitors 
            SET status = 'pendente'
            WHERE id = NEW.visitor_id;
        ELSIF v_visitor_type = 'frequente' THEN
            -- Manter status como permanent para visitantes frequentes
            NEW.status = 'permanent';
            
            -- Atualizar status do visitante na tabela visitors
            UPDATE visitors 
            SET status = 'aprovado'
            WHERE id = NEW.visitor_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Criar trigger para controle automático de status
DROP TRIGGER IF EXISTS trigger_control_visitor_status ON visitor_logs;
CREATE TRIGGER trigger_control_visitor_status
    BEFORE INSERT OR UPDATE ON visitor_logs
    FOR EACH ROW
    EXECUTE FUNCTION control_visitor_status_after_entry();

-- 11. Garantir permissões para as tabelas
GRANT ALL PRIVILEGES ON visitors TO authenticated;
GRANT ALL PRIVILEGES ON visitor_logs TO authenticated;
GRANT SELECT ON visitors TO anon;
GRANT SELECT ON visitor_logs TO anon;

-- 12. Comentários finais
COMMENT ON TABLE visitors IS 'Cadastro de visitantes com controle de tipo (comum/frequente)';
COMMENT ON TABLE visitor_logs IS 'Logs de entrada/saída com controle automático de status baseado no tipo de visitante';