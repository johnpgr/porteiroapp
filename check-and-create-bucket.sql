-- Verificar se o bucket user-photos existe
SELECT * FROM storage.buckets WHERE id = 'user-photos';

-- Se não existir, criar o bucket user-photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-photos',
  'user-photos',
  true,
  5242880, -- 5MB em bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Verificar novamente se foi criado
SELECT * FROM storage.buckets WHERE id = 'user-photos';