-- Criar bucket 'user-photos' para armazenar fotos de visitantes e moradores
-- Este bucket terá estrutura organizacional e políticas de segurança adequadas

-- Inserir bucket na tabela storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-photos',
  'user-photos',
  true, -- público para leitura
  5242880, -- 5MB em bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir que usuários autenticados façam upload de suas próprias fotos
CREATE POLICY "Authenticated users can upload photos" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir que usuários autenticados vejam suas próprias fotos
CREATE POLICY "Users can view their own photos" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir acesso público de leitura às fotos (para exibição em perfis)
CREATE POLICY "Public read access to photos" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'user-photos');

-- Política para permitir que usuários autenticados atualizem suas próprias fotos
CREATE POLICY "Users can update their own photos" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'user-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir que usuários autenticados deletem suas próprias fotos
CREATE POLICY "Users can delete their own photos" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Comentários sobre a estrutura de pastas:
-- /residents/{user_id}/profile.jpg - Fotos de perfil de moradores
-- /visitors/{user_id}/profile.jpg - Fotos de perfil de visitantes
-- A estrutura de pastas será criada automaticamente quando os arquivos forem enviados

-- Garantir que as permissões estejam corretas para os roles
GRANT SELECT ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;