-- Corrigir políticas RLS para permitir que porteiros insiram visitantes
-- e realizem outras operações necessárias

-- 1. Criar função para verificar se o usuário atual é porteiro
CREATE OR REPLACE FUNCTION is_current_user_porteiro()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se o usuário atual é porteiro na tabela profiles
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
       AND user_type = 'porteiro'
       AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar função para verificar se o usuário atual é admin ou porteiro
CREATE OR REPLACE FUNCTION is_current_user_admin_or_porteiro()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_current_user_admin() OR is_current_user_porteiro();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Remover políticas existentes da tabela visitors que podem estar conflitando
DROP POLICY IF EXISTS "admins_can_insert_visitors" ON visitors;
DROP POLICY IF EXISTS "admins_can_update_visitors" ON visitors;
DROP POLICY IF EXISTS "admins_can_delete_visitors" ON visitors;
DROP POLICY IF EXISTS "authenticated_users_can_read_visitors" ON visitors;

-- 4. Criar novas políticas para a tabela visitors
-- Política de leitura: usuários autenticados podem ler
CREATE POLICY "visitors_select_authenticated" ON visitors
  FOR SELECT
  TO authenticated
  USING (true);

-- Política de inserção: admins e porteiros podem inserir
CREATE POLICY "visitors_insert_admin_porteiro" ON visitors
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin_or_porteiro());

-- Política de atualização: admins e porteiros podem atualizar
CREATE POLICY "visitors_update_admin_porteiro" ON visitors
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin_or_porteiro())
  WITH CHECK (is_current_user_admin_or_porteiro());

-- Política de exclusão: apenas admins podem excluir
CREATE POLICY "visitors_delete_admin" ON visitors
  FOR DELETE
  TO authenticated
  USING (is_current_user_admin());

-- 5. Remover políticas existentes da tabela visitor_logs
DROP POLICY IF EXISTS "admins_can_insert_visitor_logs" ON visitor_logs;
DROP POLICY IF EXISTS "admins_can_update_visitor_logs" ON visitor_logs;
DROP POLICY IF EXISTS "admins_can_delete_visitor_logs" ON visitor_logs;
DROP POLICY IF EXISTS "authenticated_users_can_read_visitor_logs" ON visitor_logs;

-- 6. Criar novas políticas para a tabela visitor_logs
-- Política de leitura: usuários autenticados podem ler
CREATE POLICY "visitor_logs_select_authenticated" ON visitor_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Política de inserção: admins e porteiros podem inserir
CREATE POLICY "visitor_logs_insert_admin_porteiro" ON visitor_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin_or_porteiro());

-- Política de atualização: admins e porteiros podem atualizar
CREATE POLICY "visitor_logs_update_admin_porteiro" ON visitor_logs
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin_or_porteiro())
  WITH CHECK (is_current_user_admin_or_porteiro());

-- Política de exclusão: apenas admins podem excluir
CREATE POLICY "visitor_logs_delete_admin" ON visitor_logs
  FOR DELETE
  TO authenticated
  USING (is_current_user_admin());

-- 7. Remover políticas existentes da tabela vehicles
DROP POLICY IF EXISTS "admins_can_insert_vehicles" ON vehicles;
DROP POLICY IF EXISTS "admins_can_update_vehicles" ON vehicles;
DROP POLICY IF EXISTS "admins_can_delete_vehicles" ON vehicles;
DROP POLICY IF EXISTS "authenticated_users_can_read_vehicles" ON vehicles;

-- 8. Criar novas políticas para a tabela vehicles
-- Política de leitura: usuários autenticados podem ler
CREATE POLICY "vehicles_select_authenticated" ON vehicles
  FOR SELECT
  TO authenticated
  USING (true);

-- Política de inserção: admins e porteiros podem inserir
CREATE POLICY "vehicles_insert_admin_porteiro" ON vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin_or_porteiro());

-- Política de atualização: admins e porteiros podem atualizar
CREATE POLICY "vehicles_update_admin_porteiro" ON vehicles
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin_or_porteiro())
  WITH CHECK (is_current_user_admin_or_porteiro());

-- Política de exclusão: apenas admins podem excluir
CREATE POLICY "vehicles_delete_admin" ON vehicles
  FOR DELETE
  TO authenticated
  USING (is_current_user_admin());

-- 9. Remover políticas existentes da tabela deliveries
DROP POLICY IF EXISTS "admins_can_insert_deliveries" ON deliveries;
DROP POLICY IF EXISTS "admins_can_update_deliveries" ON deliveries;
DROP POLICY IF EXISTS "admins_can_delete_deliveries" ON deliveries;
DROP POLICY IF EXISTS "authenticated_users_can_read_deliveries" ON deliveries;

-- 10. Criar novas políticas para a tabela deliveries
-- Política de leitura: usuários autenticados podem ler
CREATE POLICY "deliveries_select_authenticated" ON deliveries
  FOR SELECT
  TO authenticated
  USING (true);

-- Política de inserção: admins e porteiros podem inserir
CREATE POLICY "deliveries_insert_admin_porteiro" ON deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin_or_porteiro());

-- Política de atualização: admins e porteiros podem atualizar
CREATE POLICY "deliveries_update_admin_porteiro" ON deliveries
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin_or_porteiro())
  WITH CHECK (is_current_user_admin_or_porteiro());

-- Política de exclusão: apenas admins podem excluir
CREATE POLICY "deliveries_delete_admin" ON deliveries
  FOR DELETE
  TO authenticated
  USING (is_current_user_admin());

-- 11. Garantir que RLS está habilitado em todas as tabelas
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- 12. Garantir permissões para a role authenticated
GRANT ALL PRIVILEGES ON visitors TO authenticated;
GRANT ALL PRIVILEGES ON visitor_logs TO authenticated;
GRANT ALL PRIVILEGES ON vehicles TO authenticated;
GRANT ALL PRIVILEGES ON deliveries TO authenticated;

-- 13. Testar as funções
SELECT 'Funções e políticas RLS para porteiros criadas com sucesso' as status;