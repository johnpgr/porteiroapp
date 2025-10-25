-- Criar usuário de teste para super admin se não existir
-- Este usuário será usado para testar o login do sistema

DO $$
DECLARE
  test_user_id uuid;
  existing_count integer;
BEGIN
  -- Verificar se já existe um super admin de teste
  SELECT COUNT(*) INTO existing_count 
  FROM super_admin_profiles 
  WHERE email = 'admin@porteiroapp.com';
  
  -- Se não existir, criar o usuário de teste
  IF existing_count = 0 THEN
    -- Primeiro, criar o usuário no auth.users (simulando um usuário já existente)
    -- Na prática, este usuário deve ser criado através do Supabase Auth
    
    -- Inserir o perfil de super admin de teste
    INSERT INTO super_admin_profiles (
      user_id,
      email,
      full_name,
      phone,
      admin_type,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      '80a55270-5c37-4f05-9814-f5df3a28de28'::uuid, -- ID do usuário que está tentando fazer login
      'admin@porteiroapp.com',
      'Super Administrador',
      '+55 11 99999-9999',
      'super_admin',
      true,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Usuário de teste super admin criado com sucesso!';
  ELSE
    RAISE NOTICE 'Usuário de teste super admin já existe.';
  END IF;
END
$$;

-- Comentário para documentar
COMMENT ON TABLE super_admin_profiles IS 'Tabela para armazenar perfis de super administradores - Usuário de teste criado';