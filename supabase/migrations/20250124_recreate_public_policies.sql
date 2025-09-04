-- Migração para recriar políticas públicas do bucket user-photos
-- Remove todas as políticas existentes e cria novas para acesso público total

-- Remover TODAS as políticas existentes para storage.objects relacionadas ao bucket user-photos
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Buscar e remover todas as políticas na tabela storage.objects
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      policy_record.policyname, 
                      policy_record.schemaname, 
                      policy_record.tablename);
    END LOOP;
END $$;

-- Garantir que o bucket user-photos existe e está configurado como público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-photos', 'user-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Criar política única para permitir acesso público total ao bucket user-photos
CREATE POLICY "user_photos_public_access"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'user-photos')
WITH CHECK (bucket_id = 'user-photos');

-- Garantir que RLS está habilitado na tabela storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Comentário explicativo
-- Este bucket agora permite que qualquer usuário (incluindo anônimos) possa:
-- 1. Fazer upload de arquivos
-- 2. Visualizar arquivos
-- 3. Atualizar arquivos
-- 4. Deletar arquivos
-- Mantém as restrições de tamanho (5MB) e tipos de arquivo (JPEG, PNG, WebP)