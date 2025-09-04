-- Script simplificado para corrigir políticas RLS do bucket user-photos
-- Focando apenas nas operações que temos permissão para executar

-- Garantir que o bucket user-photos existe e está configurado como público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-photos', 'user-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Remover políticas específicas que podem estar causando conflito
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

-- Criar uma única política que permite TUDO para o bucket user-photos
CREATE POLICY "user_photos_unrestricted_access" ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'user-photos')
WITH CHECK (bucket_id = 'user-photos');

-- Verificar o resultado
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE name = 'user-photos';