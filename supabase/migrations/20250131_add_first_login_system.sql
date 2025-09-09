-- Migration: Add First Login System
-- Description: Adiciona campos para controle de primeiro login e sistema de verificação
-- Date: 2025-01-31

-- 1. Modificar tabela profiles para adicionar campos de controle de primeiro login
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_login_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profile_completion_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS photo_verification_status VARCHAR(20) DEFAULT 'pending' 
  CHECK (photo_verification_status IN ('pending', 'approved', 'rejected'));

-- 2. Criar tabela de verificações para auditoria
CREATE TABLE IF NOT EXISTS profile_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    verification_type VARCHAR(50) NOT NULL 
      CHECK (verification_type IN ('photo', 'cpf', 'data', 'complete')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
      CHECK (status IN ('pending', 'approved', 'rejected')),
    verified_by UUID REFERENCES profiles(id),
    verification_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON profiles(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_first_login ON profiles(first_login_completed);
CREATE INDEX IF NOT EXISTS idx_profiles_photo_status ON profiles(photo_verification_status);
CREATE INDEX IF NOT EXISTS idx_profile_verifications_profile_id ON profile_verifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_verifications_status ON profile_verifications(status);
CREATE INDEX IF NOT EXISTS idx_profile_verifications_date ON profile_verifications(verification_date DESC);

-- 4. Adicionar constraint para CPF único (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_cpf' AND table_name = 'profiles'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT unique_cpf UNIQUE (cpf);
    END IF;
END $$;

-- 5. Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Criar trigger para atualizar updated_at na tabela profiles (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_profiles_updated_at'
    ) THEN
        CREATE TRIGGER update_profiles_updated_at 
        BEFORE UPDATE ON profiles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 7. Habilitar RLS nas novas tabelas
ALTER TABLE profile_verifications ENABLE ROW LEVEL SECURITY;

-- 8. Criar políticas RLS para profile_verifications

-- Usuários podem ver suas próprias verificações
CREATE POLICY "Usuários podem ver suas próprias verificações"
ON profile_verifications FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('porteiro', 'admin')
    )
);

-- Apenas porteiros podem criar verificações
CREATE POLICY "Apenas porteiros podem criar verificações"
ON profile_verifications FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('porteiro', 'admin')
    )
);

-- Apenas porteiros podem atualizar verificações
CREATE POLICY "Apenas porteiros podem atualizar verificações"
ON profile_verifications FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('porteiro', 'admin')
    )
);

-- 9. Atualizar políticas RLS existentes da tabela profiles para incluir novos campos

-- Política para usuários verem seu próprio perfil (já existe, mas garantir que inclui novos campos)
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON profiles;
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Política para porteiros verem todos os perfis (já existe, mas garantir que inclui novos campos)
DROP POLICY IF EXISTS "Porteiros podem ver todos os perfis" ON profiles;
CREATE POLICY "Porteiros podem ver todos os perfis"
ON profiles FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('porteiro', 'admin')
    )
);

-- Política para usuários atualizarem seu próprio perfil (já existe, mas garantir que inclui novos campos)
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON profiles;
CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 10. Comentários para documentação
COMMENT ON COLUMN profiles.first_login_completed IS 'Indica se o usuário completou o primeiro login obrigatório';
COMMENT ON COLUMN profiles.profile_completion_date IS 'Data e hora em que o perfil foi completado';
COMMENT ON COLUMN profiles.photo_verification_status IS 'Status da verificação da foto: pending, approved, rejected';
COMMENT ON TABLE profile_verifications IS 'Tabela de auditoria para verificações de perfil';

-- Fim da migration