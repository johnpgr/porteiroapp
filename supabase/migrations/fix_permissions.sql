-- Configurar permissões para as tabelas buildings e apartments
-- Este arquivo corrige as políticas RLS para permitir acesso aos dados

-- 1. Conceder permissões básicas para o role anon (usuários não autenticados)
GRANT SELECT ON buildings TO anon;
GRANT SELECT ON apartments TO anon;

-- 2. Conceder permissões completas para o role authenticated (usuários autenticados)
GRANT ALL PRIVILEGES ON buildings TO authenticated;
GRANT ALL PRIVILEGES ON apartments TO authenticated;

-- 3. Criar políticas RLS mais permissivas para desenvolvimento

-- Política para buildings - permitir todas as operações para usuários autenticados
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON buildings;
CREATE POLICY "Enable all operations for authenticated users" ON buildings
    FOR ALL USING (true) WITH CHECK (true);

-- Política para buildings - permitir leitura para usuários anônimos
DROP POLICY IF EXISTS "Enable read access for all users" ON buildings;
CREATE POLICY "Enable read access for all users" ON buildings
    FOR SELECT USING (true);

-- Política para apartments - permitir todas as operações para usuários autenticados
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON apartments;
CREATE POLICY "Enable all operations for authenticated users" ON apartments
    FOR ALL USING (true) WITH CHECK (true);

-- Política para apartments - permitir leitura para usuários anônimos
DROP POLICY IF EXISTS "Enable read access for all users" ON apartments;
CREATE POLICY "Enable read access for all users" ON apartments
    FOR SELECT USING (true);

-- 4. Verificar as permissões atuais (para debug)
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND grantee IN ('anon', 'authenticated') 
    AND table_name IN ('buildings', 'apartments')
ORDER BY table_name, grantee;