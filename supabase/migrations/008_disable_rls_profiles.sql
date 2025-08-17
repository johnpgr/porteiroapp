-- Migração para desabilitar completamente RLS da tabela profiles
-- Solução temporária para resolver recursão infinita

-- Remover todas as políticas existentes
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

-- Desabilitar RLS completamente na tabela profiles
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Comentário explicativo
COMMENT ON TABLE profiles IS 'RLS desabilitado temporariamente devido a recursão infinita nas políticas. Segurança implementada na camada de aplicação.';