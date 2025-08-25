-- Migração para conceder permissões necessárias na tabela poll_votes
-- Data: 2025-01-27
-- Objetivo: Resolver erro "permission denied for table poll_votes"
-- Problema: Faltam permissões básicas para os roles anon e authenticated

-- =====================================================
-- CONCEDER PERMISSÕES PARA ROLES
-- =====================================================

-- Conceder permissões completas para usuários autenticados
-- Necessário para que as políticas RLS funcionem corretamente
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;

-- Conceder apenas leitura para usuários anônimos
-- Permite visualização pública de resultados se necessário
GRANT SELECT ON public.poll_votes TO anon;

-- =====================================================
-- VERIFICAÇÃO E LOG
-- =====================================================

DO $$
BEGIN
    -- Verificar se as permissões foram concedidas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE table_schema = 'public' 
        AND table_name = 'poll_votes' 
        AND grantee = 'authenticated'
        AND privilege_type = 'SELECT'
    ) THEN
        RAISE EXCEPTION 'ERRO: Permissões não foram concedidas para authenticated';
    END IF;
    
    RAISE NOTICE 'SUCESSO: Permissões concedidas para poll_votes';
    RAISE NOTICE 'AUTHENTICATED: SELECT, INSERT, UPDATE, DELETE';
    RAISE NOTICE 'ANON: SELECT';
END $$;

-- Query para verificar permissões concedidas:
-- SELECT grantee, table_name, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_schema = 'public' AND table_name = 'poll_votes' 
-- AND grantee IN ('anon', 'authenticated') 
-- ORDER BY grantee, privilege_type;