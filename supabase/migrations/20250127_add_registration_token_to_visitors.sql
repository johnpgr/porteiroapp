-- Adicionar coluna registration_token à tabela visitors
-- Data: 2025-01-27
-- Descrição: Adiciona campo registration_token para controle de pré-cadastro de visitantes

-- Adicionar coluna registration_token
ALTER TABLE visitors 
ADD COLUMN registration_token TEXT;

-- Adicionar índice para melhor performance nas consultas por token
CREATE INDEX idx_visitors_registration_token ON visitors(registration_token);

-- Adicionar comentário explicativo
COMMENT ON COLUMN visitors.registration_token IS 'Token único gerado durante o pré-cadastro do visitante para validação posterior';