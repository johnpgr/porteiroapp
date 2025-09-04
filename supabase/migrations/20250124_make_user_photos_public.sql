-- Tornar o bucket user-photos completamente público
-- Remove políticas RLS restritivas e permite acesso público total

-- 1. Remover todas as políticas RLS existentes para o bucket user-photos
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own photos" ON storage.objects;

-- 2. Criar política de acesso público total (leitura e escrita)
CREATE POLICY "Allow public access to user-photos bucket" ON storage.objects
  FOR ALL USING (bucket_id = 'user-photos');

-- 3. Garantir que o bucket está configurado como público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'user-photos';

-- 4. Verificar configurações do bucket
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'user-photos';

-- 5. Verificar políticas aplicadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%user-photos%';