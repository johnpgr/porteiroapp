-- Adicionar coluna access_type à tabela visitors
ALTER TABLE visitors 
ADD COLUMN access_type TEXT NOT NULL DEFAULT 'com_aprovacao' 
CHECK (access_type IN ('direto', 'com_aprovacao'));

-- Criar índice para melhor performance
CREATE INDEX idx_visitors_access_type ON visitors(access_type);

-- Comentário da coluna
COMMENT ON COLUMN visitors.access_type IS 'Tipo de acesso do visitante: direto ou com_aprovacao';

-- Atualizar visitantes existentes para usar o valor padrão
UPDATE visitors SET access_type = 'com_aprovacao' WHERE access_type IS NULL;