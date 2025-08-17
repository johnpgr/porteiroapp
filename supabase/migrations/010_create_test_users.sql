-- Migration para criar usuários de teste no Supabase Auth nativo
-- Esta migration cria os usuários diretamente no auth.users e seus profiles

-- 1. Inserir usuários de teste no auth.users
-- NOTA: Estas inserções precisam ser feitas com privilégios de service_role

-- Admin de teste
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'admin@teste.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"user_type": "admin"}',
  false,
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Porteiro de teste
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'porteiro@teste.com',
  crypt('porteiro123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"user_type": "porteiro"}',
  false,
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Morador de teste
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'morador@teste.com',
  crypt('morador123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"user_type": "morador"}',
  false,
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- 2. Inserir profiles correspondentes
-- O trigger handle_new_user pode não funcionar para inserções diretas, então vamos inserir manualmente

-- Profile do Admin
INSERT INTO public.profiles (
  id,
  email,
  user_type,
  condominium_id,
  building_id,
  apartment_id,
  is_active
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'admin@teste.com',
  'admin',
  (SELECT id FROM public.condominiums WHERE name = 'Residencial Teste' LIMIT 1),
  NULL,
  NULL,
  true
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  user_type = EXCLUDED.user_type,
  condominium_id = EXCLUDED.condominium_id,
  is_active = EXCLUDED.is_active;

-- Profile do Porteiro
INSERT INTO public.profiles (
  id,
  email,
  user_type,
  condominium_id,
  building_id,
  apartment_id,
  is_active
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'porteiro@teste.com',
  'porteiro',
  (SELECT id FROM public.condominiums WHERE name = 'Residencial Teste' LIMIT 1),
  (SELECT id FROM public.buildings WHERE name = 'Bloco A' LIMIT 1),
  NULL,
  true
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  user_type = EXCLUDED.user_type,
  condominium_id = EXCLUDED.condominium_id,
  building_id = EXCLUDED.building_id,
  is_active = EXCLUDED.is_active;

-- Profile do Morador
INSERT INTO public.profiles (
  id,
  email,
  user_type,
  condominium_id,
  building_id,
  apartment_id,
  is_active
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'morador@teste.com',
  'morador',
  (SELECT id FROM public.condominiums WHERE name = 'Residencial Teste' LIMIT 1),
  (SELECT id FROM public.buildings WHERE name = 'Bloco A' LIMIT 1),
  (SELECT id FROM public.apartments WHERE number = '101' LIMIT 1),
  true
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  user_type = EXCLUDED.user_type,
  condominium_id = EXCLUDED.condominium_id,
  building_id = EXCLUDED.building_id,
  apartment_id = EXCLUDED.apartment_id,
  is_active = EXCLUDED.is_active;