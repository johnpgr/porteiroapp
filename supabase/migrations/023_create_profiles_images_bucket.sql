-- Nota: O bucket 'profiles-images' deve ser criado manualmente no painel do Supabase Storage
-- Este arquivo contém apenas as políticas RLS para o bucket

-- Política para permitir que usuários autenticados façam upload de imagens
CREATE POLICY "Authenticated users can upload profile images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profiles-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que todos vejam imagens de perfil (bucket público)
CREATE POLICY "Anyone can view profile images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'profiles-images');

-- Política para permitir que usuários autenticados atualizem suas próprias imagens
CREATE POLICY "Users can update own profile images" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'profiles-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profiles-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuários autenticados deletem suas próprias imagens
CREATE POLICY "Users can delete own profile images" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'profiles-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Comentário: Lembrar de criar o bucket 'profiles-images' manualmente no painel do Supabase
-- com configuração pública habilitada