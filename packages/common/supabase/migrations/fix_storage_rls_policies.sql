-- Criar bucket user-photos se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-photos', 'user-photos', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Verificar se o bucket foi criado
SELECT * FROM storage.buckets WHERE name = 'user-photos';