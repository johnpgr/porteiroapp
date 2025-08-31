-- Adicionar coluna visitor_id à tabela temporary_passwords
ALTER TABLE temporary_passwords 
ADD COLUMN visitor_id uuid REFERENCES visitors(id);

-- Modificar a restrição NOT NULL do profile_id para permitir NULL quando visitor_id for usado
ALTER TABLE temporary_passwords 
ALTER COLUMN profile_id DROP NOT NULL;

-- Adicionar constraint para garantir que pelo menos um dos dois campos seja preenchido
ALTER TABLE temporary_passwords 
ADD CONSTRAINT check_profile_or_visitor 
CHECK (
  (profile_id IS NOT NULL AND visitor_id IS NULL) OR 
  (profile_id IS NULL AND visitor_id IS NOT NULL)
);

-- Comentários para documentar as mudanças
COMMENT ON COLUMN temporary_passwords.visitor_id IS 'Reference to the visitor this password belongs to (alternative to profile_id)';
COMMENT ON CONSTRAINT check_profile_or_visitor ON temporary_passwords IS 'Ensures either profile_id or visitor_id is set, but not both';