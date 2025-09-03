-- Adicionar suporte para super-admin na tabela admin_profiles
-- Verificar se a coluna admin_type já existe, se não, adicionar

-- Adicionar coluna admin_type se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'admin_profiles' 
                   AND column_name = 'admin_type') THEN
        ALTER TABLE public.admin_profiles 
        ADD COLUMN admin_type text DEFAULT 'admin' 
        CHECK (admin_type IN ('super_admin', 'admin'));
    END IF;
END $$;

-- Atualizar comentário da tabela
COMMENT ON TABLE public.admin_profiles IS 'Perfis dos administradores do sistema com suporte a super-admin e admin regular';
COMMENT ON COLUMN public.admin_profiles.admin_type IS 'Tipo de administrador: super_admin ou admin regular';

-- Criar índice para otimizar consultas por tipo de admin
CREATE INDEX IF NOT EXISTS idx_admin_profiles_admin_type ON public.admin_profiles(admin_type);

-- Garantir que existe pelo menos um super-admin no sistema
-- (Este será criado manualmente ou via processo de setup inicial)

-- Atualizar RLS policies para admin_profiles
DROP POLICY IF EXISTS "Admin profiles are viewable by authenticated users" ON public.admin_profiles;
DROP POLICY IF EXISTS "Admin profiles are editable by super admins" ON public.admin_profiles;

-- Policy para visualização: super-admins podem ver todos, admins só veem a si mesmos
CREATE POLICY "Admin profiles viewable by authenticated users" ON public.admin_profiles
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.admin_profiles ap 
            WHERE ap.user_id = auth.uid() 
            AND ap.admin_type = 'super_admin' 
            AND ap.is_active = true
        )
    );

-- Policy para edição: apenas super-admins podem editar
CREATE POLICY "Admin profiles editable by super admins" ON public.admin_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_profiles ap 
            WHERE ap.user_id = auth.uid() 
            AND ap.admin_type = 'super_admin' 
            AND ap.is_active = true
        )
    );

-- Garantir permissões para roles anon e authenticated
GRANT SELECT, INSERT, UPDATE ON public.admin_profiles TO authenticated;
GRANT SELECT ON public.admin_profiles TO anon;