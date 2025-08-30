-- Criar bucket 'profiles-fotos' para armazenar fotos de perfil dos usuários
-- Este bucket será usado para upload de fotos de perfil no formulário de completar cadastro

-- Inserir bucket na tabela storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles-fotos',
  'profiles-fotos', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir que usuários autenticados façam upload de fotos
CREATE POLICY "Authenticated users can upload profile photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profiles-fotos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que todos vejam fotos de perfil (bucket público)
CREATE POLICY "Anyone can view profile photos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'profiles-fotos');

-- Política para permitir que usuários autenticados atualizem suas próprias fotos
CREATE POLICY "Users can update own profile photos" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'profiles-fotos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuários autenticados deletem suas próprias fotos
CREATE POLICY "Users can delete own profile photos" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'profiles-fotos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Comentário: Este bucket será usado para armazenar fotos de perfil dos usuários
-- com limite de 5MB por arquivo e tipos de imagem permitidos