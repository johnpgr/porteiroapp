-- Conceder permissões para a tabela visitors
-- Permitir que usuários anônimos e autenticados possam inserir, selecionar, atualizar e deletar visitantes

-- Conceder todas as permissões para o role authenticated
GRANT ALL PRIVILEGES ON visitors TO authenticated;

-- Conceder permissões básicas para o role anon (para casos onde não há autenticação)
GRANT SELECT, INSERT, UPDATE, DELETE ON visitors TO anon;

-- Verificar se as permissões foram aplicadas
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'visitors' 
  AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;