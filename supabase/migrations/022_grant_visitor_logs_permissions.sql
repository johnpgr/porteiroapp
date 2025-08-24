-- Migração para conceder permissões adequadas na tabela visitor_logs
-- Garantir que os roles anon e authenticated tenham acesso apropriado

-- Verificar permissões atuais (apenas para referência)
-- SELECT grantee, table_name, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' AND table_name = 'visitor_logs' 
-- AND grantee IN ('anon', 'authenticated') 
-- ORDER BY table_name, grantee;

-- Conceder permissões básicas de leitura para o role anon
-- Isso permite que usuários não autenticados possam consultar logs se necessário
GRANT SELECT ON visitor_logs TO anon;

-- Conceder permissões completas para o role authenticated
-- Usuários autenticados (porteiros, moradores) precisam de acesso total
GRANT ALL PRIVILEGES ON visitor_logs TO authenticated;

-- Garantir que as políticas RLS estejam habilitadas
-- (já deve estar habilitado, mas garantindo)
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;

-- Comentário explicativo
COMMENT ON TABLE visitor_logs IS 'Logs de entrada/saída de visitantes com campo vehicle_info para armazenar dados do veículo';