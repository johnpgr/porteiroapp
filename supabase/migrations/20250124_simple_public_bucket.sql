-- Migração simples para tornar o bucket user-photos público
-- Configura o bucket como público e adiciona política de acesso público

-- Garantir que o bucket user-photos existe e está configurado como público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-photos', 'user-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Remover política específica se existir
DROP POLICY IF EXISTS "user_photos_full_public_access" ON storage.objects;

-- Criar política para permitir acesso público total ao bucket user-photos
CREATE POLICY "user_photos_full_public_access"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'user-photos')
WITH CHECK (bucket_id = 'user-photos');

-- Comentário: Bucket configurado para acesso público total
-- Qualquer usuário pode fazer upload, visualizar, atualizar e deletar arquivos
-- Mantém restrições de tamanho (5MB) e tipos de arquivo (