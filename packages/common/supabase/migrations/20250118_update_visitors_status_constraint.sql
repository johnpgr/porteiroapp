-- Atualizar constraint da tabela visitors para incluir 'não autorizado' como status válido

-- Remover a constraint existente
ALTER TABLE visitors DROP CONSTRAINT IF EXISTS visitors_status_check;

-- Adicionar a nova constraint com 'não autorizado' incluído
ALTER TABLE visitors ADD CONSTRAINT visitors_status_check 
  CHECK (status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'negado'::text, 'nao_permitido'::text, 'não autorizado'::text]));

-- Comentário explicativo
COMMENT ON CONSTRAINT visitors_status_check ON visitors IS 'Status válidos: pendente, aprovado, negado, nao_permitido, não autorizado';