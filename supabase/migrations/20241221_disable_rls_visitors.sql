-- Desabilitar completamente RLS na tabela visitors
ALTER TABLE visitors DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes da tabela visitors
DROP POLICY IF EXISTS "Allow anonymous insert visitors with pending status" ON visitors;
DROP POLICY IF EXISTS "Allow authenticated users to read all visitors" ON visitors;
DROP POLICY IF EXISTS "Allow authenticated users to update all visitors" ON visitors;
DROP POLICY IF EXISTS "Allow authenticated users to delete all visitors" ON visitors;

-- Garantir que a role anon tenha permissões básicas na tabela visitors
GRANT SELECT, INSERT, UPDATE, DELETE ON visitors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON visitors TO authenticated;

-- Verificar permissões atuais
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'visitors' 
AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;