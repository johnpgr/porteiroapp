-- Corrigir função is_admin_user e políticas RLS

-- 1. Criar ou substituir a função is_admin_user
CREATE OR REPLACE FUNCTION is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se o usuário existe na tabela admin_profiles
  RETURN EXISTS (
    SELECT 1 
    FROM admin_profiles 
    WHERE id = user_uuid 
       OR user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar função para verificar se o usuário atual é admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se o usuário atual existe na tabela admin_profiles
  RETURN EXISTS (
    SELECT 1 
    FROM admin_profiles 
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Remover políticas existentes que podem estar conflitando
DROP POLICY IF EXISTS "communications_insert_admin" ON communications;
DROP POLICY IF EXISTS "communications_update_admin" ON communications;
DROP POLICY IF EXISTS "communications_delete_admin" ON communications;
DROP POLICY IF EXISTS "communications_select_authenticated" ON communications;

-- 4. Criar novas políticas para a tabela communications
-- Política de leitura: todos os usuários autenticados podem ler
CREATE POLICY "communications_select_authenticated" ON communications
  FOR SELECT
  TO authenticated
  USING (true);

-- Política de inserção: apenas admins podem inserir
CREATE POLICY "communications_insert_admin" ON communications
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());

-- Política de atualização: apenas admins podem atualizar
CREATE POLICY "communications_update_admin" ON communications
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Política de exclusão: apenas admins podem excluir
CREATE POLICY "communications_delete_admin" ON communications
  FOR DELETE
  TO authenticated
  USING (is_current_user_admin());

-- 5. Garantir que RLS está habilitado
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

-- 6. Garantir permissões para a role authenticated
GRANT ALL PRIVILEGES ON communications TO authenticated;

-- 7. Testar a função
SELECT 'Função is_current_user_admin criada com sucesso' as status;