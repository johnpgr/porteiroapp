-- Criar um admin_profile padrão para usar em testes
-- Este admin será usado como created_by nas enquetes de teste

-- Primeiro, inserir um usuário admin padrão no auth.users se não existir
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role,
  aud
)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  'admin-test@JamesAvisa.com',
  crypt('admin123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated'
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- Inserir o admin_profile padrão se não existir
INSERT INTO public.admin_profiles (
  id,
  user_id,
  full_name,
  email,
  role,
  is_active
)
SELECT 
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Admin Teste',
  'admin-test@JamesAvisa.com',
  'admin',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_profiles WHERE id = '00000000-0000-0000-0000-000000000002'::uuid
);

-- Comentário explicativo
COMMENT ON TABLE public.admin_profiles IS 'Perfis dos administradores do sistema. Inclui admin padrão para testes.';