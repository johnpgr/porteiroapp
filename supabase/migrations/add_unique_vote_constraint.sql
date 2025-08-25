-- Adicionar constraint única para evitar múltiplos votos do mesmo usuário na mesma enquete
-- Esta constraint garante que cada usuário só pode votar uma vez por enquete

-- Primeiro, remover votos duplicados existentes (manter apenas o mais recente)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY poll_id, user_id 
      ORDER BY created_at DESC
    ) as rn
  FROM poll_votes
  WHERE poll_id IS NOT NULL AND user_id IS NOT NULL
)
DELETE FROM poll_votes 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Adicionar constraint única para poll_id + user_id
ALTER TABLE poll_votes 
ADD CONSTRAINT unique_user_poll_vote 
UNIQUE (poll_id, user_id);

-- Comentário explicativo
COMMENT ON CONSTRAINT unique_user_poll_vote ON poll_votes IS 
'Garante que cada usuário pode votar apenas uma vez por enquete';

-- Verificar se a constraint foi criada corretamente
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'unique_user_poll_vote';