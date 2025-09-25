-- Corrigir permissões para a tabela super_admin_profiles
-- Esta migração garante que as roles anon e authenticated tenham acesso adequado

-- Conceder permissões SELECT para a role authenticated
GRANT SELECT ON super_admin_profiles TO authenticated;

-- Conceder permissões SELECT para a role anon (necessário para verificação inicial)
GRANT SELECT ON super_admin_profiles TO anon;

-- Verificar se as políticas RLS existem e criar se necessário
DO $$
BEGIN
  -- Política para permitir que usuários autenticados vejam apenas seu próprio perfil
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'super_admin_profiles' 
    AND policyname = 'Users can view own super admin profile'
  ) THEN
    CREATE POLICY "Users can view own super admin profile"
      ON super_admin_profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Política para permitir acesso anônimo durante verificação de login
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'super_admin_profiles' 
    AND policyname = 'Allow anonymous access for login verification'
  ) THEN
    CREATE POLICY "Allow anonymous access for login verification"
      ON super_admin_profiles
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END
$$;

-- Comentário para documentar a migração
COMMENT ON TABLE super_admin_profiles IS 'Tabela para armazenar perfis de super administradores com acesso total ao sistema - Permissões corrigidas';