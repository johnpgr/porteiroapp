-- Migração para resetar completamente as políticas RLS da tabela profiles
-- Remove TODAS as políticas e recria apenas as essenciais

-- Desabilitar RLS completamente
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas existentes (força a remoção)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', policy_record.policyname);
    END LOOP;
END $$;

-- Reabilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Criar apenas UMA política simples para permitir acesso total durante autenticação
-- Esta política não faz referência a outras tabelas, evitando recursão
CREATE POLICY "profiles_full_access" ON profiles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Comentário explicativo
COMMENT ON POLICY "profiles_full_access" ON profiles IS 'Política temporária para permitir acesso total e evitar recursão infinita';