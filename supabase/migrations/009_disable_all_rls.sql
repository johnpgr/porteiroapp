-- Migração para desabilitar RLS em todas as tabelas relacionadas
-- Solução temporária para resolver recursão infinita entre tabelas

-- Desabilitar RLS em todas as tabelas que podem causar recursão
ALTER TABLE condominiums DISABLE ROW LEVEL SECURITY;
ALTER TABLE buildings DISABLE ROW LEVEL SECURITY;
ALTER TABLE apartments DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas das tabelas relacionadas
DO $$
DECLARE
    policy_record RECORD;
    table_name TEXT;
BEGIN
    -- Loop através das tabelas
    FOR table_name IN SELECT unnest(ARRAY['condominiums', 'buildings', 'apartments', 'profiles'])
    LOOP
        -- Remover todas as políticas de cada tabela
        FOR policy_record IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = table_name AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, table_name);
        END LOOP;
    END LOOP;
END $$;

-- Comentários explicativos
COMMENT ON TABLE condominiums IS 'RLS desabilitado temporariamente - recursão infinita';
COMMENT ON TABLE buildings IS 'RLS desabilitado temporariamente - recursão infinita';
COMMENT ON TABLE apartments IS 'RLS desabilitado temporariamente - recursão infinita';
COMMENT ON TABLE profiles IS 'RLS desabilitado temporariamente - recursão infinita';