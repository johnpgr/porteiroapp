-- Conceder permissões para a tabela visitors
GRANT ALL PRIVILEGES ON visitors TO authenticated;
GRANT SELECT ON visitors TO anon;

-- Conceder permissões para a tabela visitor_logs
GRANT ALL PRIVILEGES ON visitor_logs TO authenticated;
GRANT SELECT ON visitor_logs TO anon;

-- Verificar se as permissões foram aplicadas
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name IN ('visitors', 'visitor_logs') 
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;