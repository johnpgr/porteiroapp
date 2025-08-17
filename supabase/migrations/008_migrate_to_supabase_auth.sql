-- Migration para migrar dados da tabela users customizada para Supabase Auth nativo
-- Esta migration cria usuários no auth.users e uma tabela profiles para dados adicionais

-- 1. Criar tabela profiles para armazenar dados adicionais dos usuários
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'porteiro', 'morador')),
  condominium_id UUID REFERENCES public.condominiums(id),
  building_id UUID REFERENCES public.buildings(id),
  apartment_id UUID REFERENCES public.apartments(id),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  push_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas RLS para profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 4. Política para admins verem profiles do seu condomínio
CREATE POLICY "Admins can view condominium profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.user_type = 'admin'
      AND admin_profile.condominium_id = profiles.condominium_id
    )
  );

-- 5. Política para porteiros verem profiles do seu prédio
CREATE POLICY "Porteiros can view building profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles porteiro_profile
      WHERE porteiro_profile.id = auth.uid()
      AND porteiro_profile.user_type = 'porteiro'
      AND porteiro_profile.building_id = profiles.building_id
    )
  );

-- 6. Criar função para inserir usuários no auth.users
-- NOTA: Esta função precisa ser executada com privilégios de service_role
-- Os usuários serão criados manualmente via dashboard do Supabase ou API

-- 7. Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Conceder permissões necessárias
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- 9. Criar índices para performance
CREATE INDEX IF NOT EXISTS profiles_user_type_idx ON public.profiles(user_type);
CREATE INDEX IF NOT EXISTS profiles_condominium_id_idx ON public.profiles(condominium_id);
CREATE INDEX IF NOT EXISTS profiles_building_id_idx ON public.profiles(building_id);
CREATE INDEX IF NOT EXISTS profiles_apartment_id_idx ON public.profiles(apartment_id);

-- 10. Comentários para documentação
COMMENT ON TABLE public.profiles IS 'Perfis de usuários com dados adicionais para o sistema de portaria';
COMMENT ON COLUMN public.profiles.user_type IS 'Tipo de usuário: admin, porteiro ou morador';
COMMENT ON COLUMN public.profiles.condominium_id IS 'ID do condomínio (obrigatório para admin)';
COMMENT ON COLUMN public.profiles.building_id IS 'ID do prédio (obrigatório para porteiro)';
COMMENT ON COLUMN public.profiles.apartment_id IS 'ID do apartamento (obrigatório para morador)';