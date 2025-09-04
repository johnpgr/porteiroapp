-- Remover TODAS as políticas RLS existentes para storage.objects relacionadas ao bucket user-photos
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

-- Garantir que o bucket user-photos existe e está configurado como público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-photos', 'user-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Criar política RLS que permite acesso público TOTAL (sem restrições)
-- Esta política permite SELECT, INSERT, UPDATE, DELETE para QUALQUER usuário (autenticado ou não)
CREATE POLICY "user_photos_public_all_access" ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'user-photos')
WITH CHECK (bucket_id = 'user-photos');

-- Verificar se RLS está habilitado na tabela storage.objects
-- (RLS deve estar habilitado, mas as políticas devem permitir acesso público)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Garantir permissões para roles anon e authenticated
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO anon;
GRANT ALL ON storage.buckets TO authenticated;

-- Verificar o resultado final
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE name = 'user-photos';

-- Listar todas as políticas ativas para storage.objects
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;