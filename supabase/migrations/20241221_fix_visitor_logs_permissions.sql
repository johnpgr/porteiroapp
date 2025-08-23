-- Desabilitar RLS na tabela visitor_logs para permitir inserções
ALTER TABLE public.visitor_logs DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes da tabela visitor_logs
DROP POLICY IF EXISTS "Enable read access for all users" ON public.visitor_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.visitor_logs;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.visitor_logs;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.visitor_logs;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.visitor_logs;
DROP POLICY IF EXISTS "Allow read access for all" ON public.visitor_logs;
DROP POLICY IF EXISTS "Allow insert for all" ON public.visitor_logs;
DROP POLICY IF EXISTS "Allow update for all" ON public.visitor_logs;
DROP POLICY IF EXISTS "Allow delete for all" ON public.visitor_logs;

-- Conceder permissões totais para as roles anon e authenticated
GRANT ALL PRIVILEGES ON public.visitor_logs TO anon;
GRANT ALL PRIVILEGES ON public.visitor_logs TO authenticated;

-- Garantir que a sequência também tenha as permissões corretas
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verificar permissões atuais
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'visitor_logs'
AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;