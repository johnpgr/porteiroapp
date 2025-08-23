-- Adicionar coluna status à tabela visitors
ALTER TABLE visitors ADD COLUMN status TEXT DEFAULT 'pendente';

-- Adicionar constraint para validar valores do status
ALTER TABLE visitors ADD CONSTRAINT visitors_status_check 
  CHECK (status IN ('pendente', 'aprovado', 'negado'));

-- Remover políticas RLS existentes para a tabela visitors
DROP POLICY IF EXISTS "visitors_select_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_insert_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_update_policy" ON visitors;
DROP POLICY IF EXISTS "visitors_delete_policy" ON visitors;

-- Política para permitir que usuários anônimos insiram visitantes com status 'pendente'
CREATE POLICY "visitors_insert_anon_policy" ON visitors
  FOR INSERT
  TO anon
  WITH CHECK (status = 'pendente');

-- Política para permitir que usuários autenticados leiam todos os visitantes
CREATE POLICY "visitors_select_auth_policy" ON visitors
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para permitir que usuários autenticados atualizem visitantes
CREATE POLICY "visitors_update_auth_policy" ON visitors
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para permitir que usuários autenticados deletem visitantes
CREATE POLICY "visitors_delete_auth_policy" ON visitors
  FOR DELETE
  TO authenticated
  USING (true);

-- Garantir que a tabela visitors tenha RLS habilitado
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

-- Conceder permissões básicas para o role anon
GRANT INSERT ON visitors TO anon;
GRANT SELECT ON visitors TO authenticated;
GRANT UPDATE ON visitors TO authenticated;
GRANT DELETE ON visitors TO authenticated;