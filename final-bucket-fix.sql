-- Script final para garantir que o bucket user-photos funcione

-- Garantir que o bucket existe e está público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-photos', 'user-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Garantir permissões básicas para anon e authenticated
GRANT SELECT ON storage.buckets TO anon;
GRANT SELECT ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;

-- Verificar o resultado final
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE name = 'user-photos';

-- Verificar permissões
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' 
    AND grantee IN ('anon', 'authenticated')
    AND table_name IN ('buckets', 'objects')
ORDER BY table_name, grantee;