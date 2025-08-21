-- Conceder permissões para as tabelas buildings, apartments e building_admins
-- Necessário para que as migrações funcionem corretamente

-- Verificar permissões atuais
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name IN ('buildings', 'apartments', 'building_admins', 'admin_profiles')
AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- Conceder permissões para a role anon (usuários não autenticados)
GRANT SELECT ON buildings TO anon;
GRANT SELECT ON apartments TO anon;
GRANT SELECT ON building_admins TO anon;
GRANT SELECT ON admin_profiles TO anon;

-- Conceder permissões para a role authenticated (usuários autenticados)
GRANT ALL PRIVILEGES ON buildings TO authenticated;
GRANT ALL PRIVILEGES ON apartments TO authenticated;
GRANT ALL PRIVILEGES ON building_admins TO authenticated;
GRANT ALL PRIVILEGES ON admin_profiles TO authenticated;

-- Conceder permissões para inserção durante migrações (service_role)
GRANT ALL PRIVILEGES ON buildings TO service_role;
GRANT ALL PRIVILEGES ON apartments TO service_role;
GRANT ALL PRIVILEGES ON building_admins TO service_role;
GRANT ALL PRIVILEGES ON admin_profiles TO service_role;

-- Verificar permissões após concessão
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name IN ('buildings', 'apartments', 'building_admins', 'admin_profiles')
AND grantee IN ('anon', 'authenticated', 'service_role') 
ORDER BY table_name, grantee;