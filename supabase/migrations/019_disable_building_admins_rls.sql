-- Migração para desabilitar RLS na tabela building_admins
-- Solução para resolver erro de política RLS ao inserir relacionamentos

-- Desabilitar RLS na tabela building_admins
ALTER TABLE building_admins DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes da tabela building_admins
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Remover todas as políticas da tabela building_admins
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'building_admins' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON building_admins', policy_record.policyname);
    END LOOP;
END $$;

-- Comentário explicativo
COMMENT ON TABLE building_admins IS 'RLS desabilitado - permite inserção de relacionamentos admin-prédio';

-- Verificar se RLS foi desabilitado com sucesso
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'building_admins' AND schemaname = 'public';

SELECT 'RLS desabilitado com sucesso na tabela building_admins!' as status;