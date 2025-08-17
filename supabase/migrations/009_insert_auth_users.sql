-- Migration simplificada para preparar o sistema para autenticação nativa do Supabase
-- Os usuários serão criados via signUp do Supabase Auth

-- 1. Criar função para handle de novos usuários autenticados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir profile quando um novo usuário é criado no auth.users
  INSERT INTO public.profiles (
    id,
    email,
    user_type,
    condominium_id,
    building_id,
    apartment_id,
    is_active
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'morador'),
    CASE 
      WHEN NEW.raw_user_meta_data->>'user_type' = 'admin' THEN 
        (SELECT id FROM public.condominiums WHERE name = 'Residencial Teste' LIMIT 1)
      WHEN NEW.raw_user_meta_data->>'user_type' = 'porteiro' THEN 
        (SELECT id FROM public.condominiums WHERE name = 'Residencial Teste' LIMIT 1)
      WHEN NEW.raw_user_meta_data->>'user_type' = 'morador' THEN 
        (SELECT id FROM public.condominiums WHERE name = 'Residencial Teste' LIMIT 1)
      ELSE NULL
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'user_type' = 'porteiro' THEN 
        (SELECT id FROM public.buildings WHERE name = 'Bloco A' LIMIT 1)
      WHEN NEW.raw_user_meta_data->>'user_type' = 'morador' THEN 
        (SELECT id FROM public.buildings WHERE name = 'Bloco A' LIMIT 1)
      ELSE NULL
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'user_type' = 'morador' THEN 
        (SELECT id FROM public.apartments WHERE number = '101' LIMIT 1)
      ELSE NULL
    END,
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Comentário explicativo
COMMENT ON FUNCTION public.handle_new_user() IS 'Função para criar profile automaticamente quando um usuário é criado no auth.users';