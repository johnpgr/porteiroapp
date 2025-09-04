-- Garantir permissões completas para os roles anon e authenticated
-- nas tabelas de storage do Supabase

-- Permissões para a tabela storage.buckets
GRANT SELECT ON storage.buckets TO anon;
GRANT SELECT ON storage.buckets TO authenticated;

-- Permissões para a tabela storage.objects
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;

-- Garantir que o bucket user-photos existe e está público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-photos', 'user-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Remover todas as políticas RLS existentes para o bucket user-photos
DROP POLICY IF EXISTS "user_photos_unrestricted_access" ON storage.objects;
DROP POLICY IF EXISTS "user_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "user_photos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "user_photos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "user_photos_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "user_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "user_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "user_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "user_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to user-photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations on user-photos" ON storage.objects;
DROP POLICY IF EXISTS "user_photos_public_all_access" ON storage.objects;

-- Criar política RLS que permite acesso público TOTAL para o bucket user-photos
CREATE POLICY "user_photos_full_public_access" ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'user-photos')
WITH CHECK (bucket_id = 'user-photos');

-- Verificar se as permissões foram aplicadas corretamente
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' 
    AND grantee IN ('anon', 'authenticated')
    AND table_name IN ('buckets', 'objects')
ORDER BY table_name, grantee;

-- Verificar o bucket user-photos
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE name = 'user-photos';

-- Verificar políticas RLS ativas
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname LIKE '%user_photos%'
ORDER BY policyname;