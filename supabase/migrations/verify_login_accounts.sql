-- Verify all test accounts are properly configured for login
-- This will show the current state of auth.users and profiles alignment

SELECT 
    'AUTH USERS STATUS' as check_type,
    au.email,
    au.id as auth_id,
    au.email_confirmed_at IS NOT NULL as email_confirmed,
    au.role,
    au.raw_user_meta_data
FROM auth.users au 
WHERE au.email IN (
    'admin@teste.com',
    'porteiro@teste.com', 
    'morador@teste.com',
    'porteiro1@teste.com',
    'porteiro2@teste.com', 
    'morador1@teste.com',
    'morador2@teste.com'
)
ORDER BY au.email;

SELECT 
    'PROFILES STATUS' as check_type,
    p.email,
    p.id as profile_id,
    p.user_type,
    p.is_active,
    c.name as condominium_name,
    b.name as building_name,
    a.number as apartment_number
FROM profiles p
LEFT JOIN condominiums c ON p.condominium_id = c.id
LEFT JOIN buildings b ON p.building_id = b.id  
LEFT JOIN apartments a ON p.apartment_id = a.id
WHERE p.email IN (
    'admin@teste.com',
    'porteiro@teste.com',
    'morador@teste.com', 
    'porteiro1@teste.com',
    'porteiro2@teste.com',
    'morador1@teste.com',
    'morador2@teste.com'
)
ORDER BY p.email;

SELECT 
    'ID ALIGNMENT CHECK' as check_type,
    au.email,
    au.id = p.id as ids_match,
    au.id as auth_id,
    p.id as profile_id
FROM auth.users au
FULL OUTER JOIN profiles p ON au.id = p.id
WHERE au.email IN (
    'admin@teste.com',
    'porteiro@teste.com',
    'morador@teste.com',
    'porteiro1@teste.com', 
    'porteiro2@teste.com',
    'morador1@teste.com',
    'morador2@teste.com'
) OR p.email IN (
    'admin@teste.com',
    'porteiro@teste.com',
    'morador@teste.com',
    'porteiro1@teste.com',
    'porteiro2@teste.com', 
    'morador1@teste.com',
    'morador2@teste.com'
)
ORDER BY COALESCE(au.email, p.email);