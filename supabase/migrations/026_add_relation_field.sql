-- Adicionar campo relation à tabela profiles
ALTER TABLE profiles ADD COLUMN relation TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN profiles.relation IS 'Relação da pessoa com o morador principal (cônjuge, filho, empregada, etc.)';

-- Atualizar trigger de updated_at se necessário
-- O trigger já existe e funcionará automaticamente para o novo campo