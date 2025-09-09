-- Migration: Create Resident Photos Bucket
-- Description: Cria bucket resident-photos para fotos dos moradores
-- Date: 2025-01-31

-- 1. Criar bucket para fotos dos moradores
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'resident-photos',
    'resident-photos',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Política para upload - usuários podem fazer upload de suas próprias fotos
CREATE POLICY "resident_photos_upload_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'resident-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Política para visualização - porteiros e próprio usuário podem ver fotos
CREATE POLICY "resident_photos_select_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'resident-photos' AND (
        auth.uid()::text = (storage.foldername(name))[1] OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('porteiro', 'admin')
        )
    )
);

-- 4. Política para atualização - apenas próprio usuário pode atualizar suas fotos
CREATE POLICY "resident_photos_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'resident-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Política para exclusão - apenas próprio usuário pode deletar suas fotos
CREATE POLICY "resident_photos_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'resident-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 6. Garantir permissões básicas
GRANT SELECT ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO anon;
GRANT ALL ON storage.buckets TO authenticated;