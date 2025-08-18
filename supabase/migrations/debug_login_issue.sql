-- Debug login issue for porteiro and morador accounts
-- Check if accounts exist and are properly configured

-- 1. Check all profiles
SELECT 
  'profiles' as table_name,
  id,
  email,
  user_type,
  condominium_id,
  building_id,
  apartment_id,
  is_active,
  created_at
FROM profiles
WHERE email IN ('porteiro@teste.com', 'morador@teste.com', 'porteiro1@teste.com', 'porteiro2@teste.com', 'morador1@teste.com', 'morador2@teste.com')
ORDER BY email;

-- 2. Check auth.users for these emails
SELECT 
  'auth.users' as table_name,
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  CASE WHEN encrypted_password IS NOT NULL THEN 'Has password' ELSE 'No password' END as password_status
FROM auth.users
WHERE email IN ('porteiro@teste.com', 'morador@teste.com', 'porteiro1@teste.com', 'porteiro2@teste.com', 'morador1@teste.com', 'morador2@teste.com')
ORDER BY email;

-- 3. Check for mismatched IDs between auth.users and profiles
SELECT 
  au.email,
  au.id as auth_id,
  p.id as profile_id,
  CASE 
    WHEN au.id = p.id THEN 'Match'
    ELSE 'Mismatch'
  END as id_status
FROM auth.users au
FULL OUTER JOIN profiles p ON au.email = p.email
WHERE au.email IN ('porteiro@teste.com', 'morador@teste.com', 'porteiro1@teste.com', 'porteiro2@teste.com', 'morador1@teste.com', 'morador2@teste.com')
   OR p.email IN ('porteiro@teste.com', 'morador@teste.com', 'porteiro1@teste.com', 'porteiro2@teste.com', 'morador1@teste.com', 'morador2@teste.com')
ORDER BY au.email, p.email;

-- 4. Check if profiles have required fields for each user type
SELECT 
  email,
  user_type,
  CASE 
    WHEN user_type = 'admin' AND condominium_id IS NOT NULL THEN 'Valid'
    WHEN user_type = 'porteiro' AND building_id IS NOT NULL THEN 'Valid'
    WHEN user_type = 'morador' AND apartment_id IS NOT NULL THEN 'Valid'
    ELSE 'Invalid - Missing required field'
  END as validation_status,
  condominium_id,
  building_id,
  apartment_id
FROM profiles
WHERE email IN ('porteiro@teste.com', 'morador@teste.com', 'porteiro1@teste.com', 'porteiro2@teste.com', 'morador1@teste.com', 'morador2@teste.com')
ORDER BY user_type, email;