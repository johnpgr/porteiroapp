-- Verificar status do realtime nas tabelas communications e polls

-- Verificar se as tabelas existem
SELECT 
    table_schema,
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('communications', 'polls')
ORDER BY table_name;

-- Verificar se as tabelas têm replica identity configurada (necessário para realtime)
SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    CASE c.relreplident
        WHEN 'd' THEN 'DEFAULT'
        WHEN 'n' THEN 'NOTHING'
        WHEN 'f' THEN 'FULL'
        WHEN 'i' THEN 'INDEX'
    END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relname IN ('communications', 'polls')
AND c.relkind = 'r';

-- Verificar RLS (Row Level Security) nas tabelas
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('communications', 'polls');