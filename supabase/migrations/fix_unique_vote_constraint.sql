-- Migração para corrigir constraint única de votação
-- Garantir que cada usuário vote apenas uma vez por enquete

-- Primeiro, remover votos duplicados se existirem
DELETE FROM poll_votes a USING (
  SELECT MIN(ctid) as ctid, user_id, poll_id
  FROM poll_votes 
  WHERE user_id IS NOT NULL AND poll_id IS NOT NULL
  GROUP BY user_id, poll_id
  HAVING COUNT(*) > 1
) b
WHERE a.user_id = b.user_id 
  AND a.poll_id = b.poll_id 
  AND a.ctid <> b.ctid;

-- Remover constraint antiga se existir
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_poll_vote') THEN
        ALTER TABLE poll_votes DROP CONSTRAINT unique_user_poll_vote;
    END IF;
END $$;

-- Adicionar nova constraint única usando user_id e poll_id
ALTER TABLE poll_votes 
ADD CONSTRAINT unique_user_poll_vote 
UNIQUE (user_id, poll_id);

-- Comentário explicativo
COMMENT ON CONSTRAINT unique_user_poll_vote ON poll_votes IS 
'Garante que cada usuário pode votar apenas uma vez por enquete';

-- Verificar se a constraint foi criada corretamente
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_poll_vote') THEN
        RAISE EXCEPTION 'Falha ao criar constraint unique_user_poll_vote';
    END IF;
    RAISE NOTICE 'Constraint unique_user_poll_vote criada com sucesso';
END $$;