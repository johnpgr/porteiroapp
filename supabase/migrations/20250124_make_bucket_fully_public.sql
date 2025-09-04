-- Migração para tornar o bucket user-photos completamente público
-- Permite que qualquer usuário (autenticado ou não) faça upload e visualize arquivos

-- Remover políticas RLS existentes para o bucket user-photos
DROP POLICY IF EXISTS "Allow public read access to user-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload to user-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to user-photos" ON storage.objects;

-- Garantir que o bucket user-photos existe e está configurado como público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-photos', 'user-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Criar política para permitir acesso público total (leitura e escrita)
CREATE POLICY "Allow public access to user-photos bucket"
ON storage.objects
FOR ALL
USING (bucket_id = 'user-photos');

-- Criar política específica para inserção pública
CREATE POLICY "Allow public insert to user-photos bucket"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'user-photos');

-- Criar política específica para seleção pública
CREATE POLICY "Allow public select from user-photos bucket"
ON storage.objects
FOR SELECT
USING (bucket_id = 'user-photos');

-- Criar política específica para atualização pública
CREATE POLICY "Allow public update to user-photos bucket"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'user-photos');

-- Criar política específica para exclusão pública
CREATE POLICY "Allow public delete from user-photos bucket"
ON storage.objects
FOR DELETE
USING (bucket_id = 'user-photos');

-- Garantir que RLS está habilitado na tabela storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Comentário explicativo
-- Este bucket agora permite que qualquer usuário (autenticado ou não) possa:
-- 1. Fazer upload de arquivos (INSERT)
-- 2. Visualizar arquivos (SELECT)
-- 3. Atualizar arquivos (UPDATE)
-- 4. Deletar arquivos (DELETE)
-- Mantém as restrições de tamanho (5MB) e tipos de arquivo (JPEG, PNG, WebP)