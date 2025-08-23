-- Adicionar coluna 'description' à tabela polls
-- Esta migração corrige o erro onde o código estava tentando inserir
-- um campo 'description' que não existia na estrutura da tabela

ALTER TABLE polls ADD COLUMN IF NOT EXISTS description TEXT;

-- Comentário da coluna para documentação
COMMENT ON COLUMN polls.description IS 'Descrição detalhada da enquete';

-- Verificar se a coluna foi criada corretamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'polls' AND column_name = 'description';