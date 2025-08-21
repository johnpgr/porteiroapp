-- Inserir perfil de administrador de teste
-- Este script adiciona um administrador de teste usando o user_id existente no auth.users

-- Inserir perfil do administrador
INSERT INTO admin_profiles (
  user_id,
  full_name,
  email,
  role,
  is_active
) VALUES (
  '2dce9e93-61c0-4d66-b765-8f4d4220b25b',
  'Douglas Admin',
  'douglas@dev.com',
  'admin',
  true
)
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = timezone('utc'::text, now());

-- Verificar se o perfil foi inserido corretamente
SELECT 
  id,
  user_id,
  full_name,
  email,
  role,
  is_active,
  created_at
FROM admin_profiles 
WHERE user_id = '2dce9e93-61c0-4d66-b765-8f4d4220b25b';

-- Comentário: Este administrador pode fazer login com:
-- Email: douglas@dev.com
-- Senha: (a senha está criptografada no auth.users)