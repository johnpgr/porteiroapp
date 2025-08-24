-- Verificar e conceder permissões para a tabela visitor_logs
-- Garantir que os roles anon e authenticated tenham acesso adequado

-- Conceder permissões SELECT para o role anon (usuários não autenticados)
GRANT SELECT ON visitor_logs TO anon;

-- Conceder todas as permissões para o role authenticated (usuários autenticados)
GRANT ALL PRIVILEGES ON visitor_logs TO authenticated;

-- Verificar as permissões atuais (para debug)
-- Esta consulta mostrará as permissões concedidas
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'visitor_logs' 
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;