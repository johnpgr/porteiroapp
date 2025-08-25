-- Adicionar campos faltantes à tabela admin_profiles
-- Campos necessários para sincronização com o formulário profile.tsx

ALTER TABLE public.admin_profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Adicionar comentários para documentar os novos campos
COMMENT ON COLUMN public.admin_profiles.phone IS 'Telefone do administrador';
COMMENT ON COLUMN public.admin_profiles.cpf IS 'CPF do administrador';
COMMENT ON COLUMN public.admin_profiles.birth_date IS 'Data de nascimento do administrador';
COMMENT ON COLUMN public.admin_profiles.address IS 'Endereço completo do administrador';
COMMENT ON COLUMN public.admin_profiles.avatar_url IS 'URL da foto de perfil do administrador';
COMMENT ON COLUMN public.admin_profiles.emergency_contact_name IS 'Nome do contato de emergência';
COMMENT ON COLUMN public.admin_profiles.emergency_contact_phone IS 'Telefone do contato de emergência';

-- Conceder permissões para os novos campos
GRANT SELECT, UPDATE ON public.admin_profiles TO authenticated;
GRANT SELECT ON public.admin_profiles TO anon;

-- Criar índices para melhorar performance em consultas
CREATE INDEX IF NOT EXISTS idx_admin_profiles_cpf ON public.admin_profiles(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_profiles_phone ON public.admin_profiles(phone) WHERE phone IS NOT NULL;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_admin_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_admin_profiles_updated_at ON public.admin_profiles;
CREATE TRIGGER trigger_update_admin_profiles_updated_at
    BEFORE UPDATE ON public.admin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_profiles_updated_at();