-- Habilitar realtime para as tabelas de notificações
-- Este script garante que as tabelas communications e polls tenham realtime habilitado

-- Verificar quais tabelas já estão na publicação realtime
SELECT 
    'CURRENT STATUS' as info,
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND schemaname = 'public'
AND tablename IN ('communications', 'polls')
ORDER BY tablename;

-- Habilitar realtime na tabela polls (enquetes) se não estiver habilitado
DO $$
BEGIN
    -- Verificar se polls não está na publicação realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'polls'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE polls;
        RAISE NOTICE 'Realtime habilitado para tabela polls';
    ELSE
        RAISE NOTICE 'Realtime já estava habilitado para tabela polls';
    END IF;
END $$;

-- Verificar status final
SELECT 
    'FINAL STATUS' as info,
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND schemaname = 'public'
AND tablename IN ('communications', 'polls')
ORDER BY tablename;