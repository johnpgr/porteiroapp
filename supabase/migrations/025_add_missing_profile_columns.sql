-- Adicionar colunas faltantes na tabela profiles
-- building_id: referência ao prédio (para porteiros)
-- role: papel do usuário (admin, porteiro, morador)
-- user_type: tipo específico do usuário (porteiro, morador)

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES public.buildings(id),
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS user_type TEXT;

-- Comentários para documentar as colunas
COMMENT ON COLUMN public.profiles.building_id IS 'Referência ao prédio onde o porteiro trabalha';
COMMENT ON COLUMN public.profiles.role IS 'Papel do usuário no sistema (admin, porteiro, morador)';
COMMENT ON COLUMN public.profiles.user_type IS 'Tipo específico do usuário (porteiro, morador)';

-- Verificar permissões para as novas colunas
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon;
GRANT ALL PRIVILEGES ON public.profiles TO authenticated;