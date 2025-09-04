-- Verificar se o bucket 'user-photos' existe e suas configurações
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at,
    updated_at
FROM storage.buckets 
WHERE name = 'user-photos';

-- Verificar todas as políticas RLS relacionadas ao bucket user-photos
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('objects', 'buckets') 
    AND (policyname LIKE '%user-photos%' OR policyname LIKE '%user_photos%');

-- Verificar políticas gerais de storage.objects
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';