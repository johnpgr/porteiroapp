-- Check all user accounts in profiles table
SELECT 
  id,
  email,
  user_type,
  condominium_id,
  building_id,
  apartment_id,
  is_active,
  created_at
FROM profiles
ORDER BY user_type, email;

-- Check auth.users table for comparison
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY email;

-- Check if there are any users in auth.users but not in profiles
SELECT 
  au.id,
  au.email,
  'Missing in profiles' as status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Check if there are any users in profiles but not in auth.users
SELECT 
  p.id,
  p.email,
  'Missing in auth.users' as status
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL;