-- Criar bucket para fotos de perfil
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir que usuários autenticados façam upload de suas próprias fotos
CREATE POLICY "Users can upload their own profile photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir que usuários autenticados vejam suas próprias fotos
CREATE POLICY "Users can view their own profile photos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir que usuários autenticados atualizem suas próprias fotos
CREATE POLICY "Users can update their own profile photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir que usuários autenticados deletem suas próprias fotos
CREATE POLICY "Users can delete their own profile photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para permitir acesso público às fotos (para visualização)
CREATE POLICY "Public can view profile photos" ON storage.objects
FOR SELECT USING (bucket_id = 'profile-photos');