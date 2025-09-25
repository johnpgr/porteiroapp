-- Migração para Sistema de Super-Admin
-- Criação da tabela super_admin_profiles e políticas RLS

-- Criar tabela super_admin_profiles
CREATE TABLE IF NOT EXISTS super_admin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    admin_type VARCHAR(20) DEFAULT 'super_admin' CHECK (admin_type IN ('super_admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_super_admin_profiles_user_id ON super_admin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_profiles_email ON super_admin_profiles(email);
CREATE INDEX IF NOT EXISTS idx_super_admin_profiles_active ON super_admin_profiles(is_active);

-- Atualizar tabela admin_profiles para incluir admin_type se não existir
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS admin_type VARCHAR(20) DEFAULT 'regular' CHECK (admin_type IN ('regular', 'super_admin'));

-- Função para verificar se usuário é super admin (atualizada)
CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admin_profiles 
    WHERE super_admin_profiles.user_id = $1 AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE admin_profiles.user_id = $1 AND admin_type = 'super_admin' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS na tabela super_admin_profiles
ALTER TABLE super_admin_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para super_admin_profiles
-- Super admins podem ver todos os perfis de super admin
CREATE POLICY "Super admins can view all super admin profiles" ON super_admin_profiles
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Super admins podem inserir novos super admins
CREATE POLICY "Super admins can insert super admin profiles" ON super_admin_profiles
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

-- Super admins podem atualizar perfis de super admin
CREATE POLICY "Super admins can update super admin profiles" ON super_admin_profiles
  FOR UPDATE USING (is_super_admin(auth.uid()));

-- Super admins podem deletar perfis de super admin
CREATE POLICY "Super admins can delete super admin profiles" ON super_admin_profiles
  FOR DELETE USING (is_super_admin(auth.uid()));

-- Atualizar políticas existentes para incluir super admins
-- Políticas para buildings
DROP POLICY IF EXISTS "Super admins can view all buildings" ON buildings;
CREATE POLICY "Super admins can view all buildings" ON buildings
  FOR SELECT USING (is_super_admin(auth.uid()) OR is_building_admin(auth.uid(), id));

DROP POLICY IF EXISTS "Super admins can insert buildings" ON buildings;
CREATE POLICY "Super admins can insert buildings" ON buildings
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can update all buildings" ON buildings;
CREATE POLICY "Super admins can update all buildings" ON buildings
  FOR UPDATE USING (is_super_admin(auth.uid()) OR is_building_admin(auth.uid(), id));

DROP POLICY IF EXISTS "Super admins can delete buildings" ON buildings;
CREATE POLICY "Super admins can delete buildings" ON buildings
  FOR DELETE USING (is_super_admin(auth.uid()));

-- Políticas para admin_profiles
DROP POLICY IF EXISTS "Super admins can manage all admin profiles" ON admin_profiles;
CREATE POLICY "Super admins can manage all admin profiles" ON admin_profiles
  FOR ALL USING (is_super_admin(auth.uid()));

-- Políticas para profiles (moradores/porteiros)
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON profiles;
CREATE POLICY "Super admins can manage all profiles" ON profiles
  FOR ALL USING (is_super_admin(auth.uid()));

-- Políticas para building_admins
DROP POLICY IF EXISTS "Super admins can manage building admins" ON building_admins;
CREATE POLICY "Super admins can manage building admins" ON building_admins
  FOR ALL USING (is_super_admin(auth.uid()));

-- Políticas para apartments
DROP POLICY IF EXISTS "Super admins can manage all apartments" ON apartments;
CREATE POLICY "Super admins can manage all apartments" ON apartments
  FOR ALL USING (is_super_admin(auth.uid()) OR is_building_admin(auth.uid(), building_id));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_super_admin_profiles_updated_at
    BEFORE UPDATE ON super_admin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Permissões para roles anônimo e autenticado
GRANT SELECT ON super_admin_profiles TO anon;
GRANT ALL PRIVILEGES ON super_admin_profiles TO authenticated;

-- Comentários para documentação
COMMENT ON TABLE super_admin_profiles IS 'Tabela para armazenar perfis de super administradores com acesso total ao sistema';
COMMENT ON COLUMN super_admin_profiles.admin_type IS 'Tipo de administrador, sempre super_admin para esta tabela';
COMMENT ON COLUMN super_admin_profiles.is_active IS 'Status ativo do super administrador';