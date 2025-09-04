-- Script para corrigir a visibilidade dos buckets para o role anon
-- O problema é que o role anon não consegue ver os buckets

-- Primeiro, verificar as permissões atuais
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' 
    AND grantee IN ('anon', 'authenticated', 'public')
    AND table_name = 'buckets'
ORDER BY grantee, privilege_type;

-- Garantir permissões de SELECT para anon na tabela buckets
GRANT SELECT ON storage.buckets TO anon;
GRANT SELECT ON storage.buckets TO authenticated;
GRANT SELECT ON storage.buckets TO public;

-- Verificar se existe alguma política RLS na tabela buckets que esteja bloqueando
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
    AND tablename = 'buckets'
ORDER BY policyname;

-- Se não existir política para buckets, criar uma que permita SELECT público
DO $$
BEGIN
    -- Verificar se RLS está habilitado na tabela buckets
    IF EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'storage' 
        AND c.relname = 'buckets' 
        AND c.relrowsecurity = true
    ) THEN
        -- Se RLS estiver habilitado, criar política para permitir SELECT público
        DROP POLICY IF EXISTS "buckets_public_select" ON storage.buckets;
        CREATE POLICY "buckets_public_select" ON storage.buckets
        FOR SELECT
        TO public
        USING (true);
        
        RAISE NOTICE 'Política de SELECT público criada para storage.buckets';
    ELSE
        RAISE NOTICE 'RLS não está habilitado na tabela storage.buckets';
    END IF;
END
$$;

-- Verificar o bucket user-photos
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at,
    updated_at
FROM storage.buckets 
WHERE name = 'user-photos';

-- Verificar as permissões finais
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' 
    AND grantee IN ('anon', 'authenticated', 'public')
    AND table_name IN ('buckets', 'objects')
ORDER BY table_name, grantee, privilege_type;