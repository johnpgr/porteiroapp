-- Criar bucket 'profiles-images' para armazenar avatars dos usuários
-- Este bucket será usado para upload de fotos de perfil

-- Inserir bucket na tabela storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles-images',
  'profiles-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Comentário: Este bucket será usado para armazenar avatars dos usuários
-- com limite de 5MB por arquivo e tipos de