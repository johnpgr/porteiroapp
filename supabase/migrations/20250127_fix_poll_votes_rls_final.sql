-- Migração para corrigir definitivamente as políticas RLS da tabela poll_votes
-- Data: 2025-01-27
-- Objetivo: Resolver erro 42501 (violação de política RLS) ao votar
-- Problema: Políticas conflitantes entre arquivos de migração

-- =====================================================
-- LIMPEZA: Remover todas as políticas conflitantes
-- =====================================================

-- Remover políticas restritivas do arquivo 20241220_fix_rls_policies.sql
DROP POLICY IF EXISTS "admins_can_insert_poll_votes" ON public.poll_votes;
DROP POLICY IF EXISTS "admins_can_update_poll_votes" ON public.poll_votes;
DROP POLICY IF EXISTS "admins_can_delete_poll_votes" ON public.poll_votes;
DROP POLICY IF EXISTS "authenticated_users_can_read_poll_votes" ON public.poll_votes;

-- Remover políticas do arquivo fix_poll_votes_rls.sql (para recriar com nomes consistentes)
DROP POLICY IF EXISTS "Authenticated users can view poll votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Authenticated users can insert their own votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Users can update their own votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Users can delete their own votes" ON public.poll_votes;

-- Remover outras políticas que possam existir
DROP POLICY IF EXISTS "Users can view poll votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Users can insert their own votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Anonymous users can view poll votes" ON public.poll_votes;

-- =====================================================
-- CONFIGURAÇÃO: Garantir que RLS está habilitado
-- =====================================================

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS CORRETAS: Permitir votação de usuários autenticados
-- =====================================================

-- Política de leitura: usuários autenticados podem ver todos os votos
-- Necessário para exibir resultados das enquetes
CREATE POLICY "authenticated_users_can_read_poll_votes" ON public.poll_votes
    FOR SELECT 
    TO authenticated
    USING (true);

-- Política de inserção: usuários autenticados podem votar apenas em seu próprio nome
-- Esta é a política principal que resolve o erro 42501
CREATE POLICY "authenticated_users_can_insert_own_votes" ON public.poll_votes
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Política de atualização: usuários podem atualizar apenas seus próprios votos
-- Permite mudança de voto se necessário
CREATE POLICY "authenticated_users_can_update_own_votes" ON public.poll_votes
    FOR UPDATE 
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Política de exclusão: usuários podem excluir apenas seus próprios votos
-- Permite cancelamento de voto se necessário
CREATE POLICY "authenticated_users_can_delete_own_votes" ON public.poll_votes
    FOR DELETE 
    TO authenticated
    USING (auth.uid() = user_id);

-- =====================================================
-- PERMISSÕES: Revogar acesso desnecessário do role anon
-- =====================================================

-- Revogar todas as permissões do role anon na tabela poll_votes
-- Apenas usuários autenticados devem poder votar
REVOKE ALL ON public.poll_votes FROM anon;

-- =====================================================
-- COMENTÁRIOS EXPLICATIVOS
-- =====================================================

COMMENT ON POLICY "authenticated_users_can_read_poll_votes" ON public.poll_votes IS 
'Permite que usuários autenticados vejam todos os votos para exibir resultados das enquetes';

COMMENT ON POLICY "authenticated_users_can_insert_own_votes" ON public.poll_votes IS 
'Permite que usuários autenticados votem apenas em seu próprio nome (user_id = auth.uid()). Esta política resolve o erro 42501.';

COMMENT ON POLICY "authenticated_users_can_update_own_votes" ON public.poll_votes IS 
'Permite que usuários atualizem apenas seus próprios votos para mudança de voto';

COMMENT ON POLICY "authenticated_users_can_delete_own_votes" ON public.poll_votes IS 
'Permite que usuários excluam apenas seus próprios votos para cancelamento';

-- =====================================================
-- VERIFICAÇÃO E LOG
-- =====================================================

DO $$
BEGIN
    -- Verificar se RLS está habilitado
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'poll_votes' 
        AND relrowsecurity = true
    ) THEN
        RAISE EXCEPTION 'ERRO: RLS não está habilitado na tabela poll_votes';
    END IF;
    
    -- Verificar se as políticas foram criadas
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'poll_votes' 
        AND policyname = 'authenticated_users_can_insert_own_votes'
    ) THEN
        RAISE EXCEPTION 'ERRO: Política de inserção não foi criada';
    END IF;
    
    RAISE NOTICE 'SUCESSO: Políticas RLS para poll_votes configuradas corretamente';
    RAISE NOTICE 'RESOLUÇÃO: Erro 42501 deve estar resolvido - usuários autenticados podem votar';
END $$;

-- =====================================================
-- INSTRUÇÕES PARA TESTE
-- =====================================================

-- Para testar se a migração funcionou:
-- 1. Faça login como um usuário autenticado
-- 2. Tente votar em uma enquete ativa
-- 3. O voto deve ser inserido sem erro 42501
-- 4. Verifique se o voto aparece nos resultados

-- Query para verificar políticas ativas:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
-- FROM pg_policies WHERE tablename = 'poll_votes';