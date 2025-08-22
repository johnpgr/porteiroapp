-- Migração para permitir múltiplos moradores por apartamento
-- Remove apartment_id da tabela profiles e usa a tabela residents como relacionamento N:N

-- 1. Migrar dados existentes da tabela profiles para residents
-- Inserir registros na tabela residents para usuários que já têm apartment_id
INSERT INTO residents (user_id, apartment_id, is_owner, created_at)
SELECT 
    id as user_id,
    apartment_id,
    true as is_owner, -- Assumir que o primeiro morador é proprietário
    created_at
FROM profiles 
WHERE apartment_id IS NOT NULL
AND user_type = 'morador'
ON CONFLICT DO NOTHING; -- Evitar duplicatas se já existirem registros

-- 2. Remover a coluna apartment_id da tabela profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS apartment_id;

-- 3. Atualizar a tabela residents para garantir estrutura adequada
-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_residents_user_id ON residents(user_id);
CREATE INDEX IF NOT EXISTS idx_residents_apartment_id ON residents(apartment_id);
CREATE INDEX IF NOT EXISTS idx_residents_user_apartment ON residents(user_id, apartment_id);

-- 4. Adicionar constraint para evitar duplicatas (um usuário não pode estar no mesmo apartamento duas vezes)
ALTER TABLE residents 
ADD CONSTRAINT unique_user_apartment 
UNIQUE (user_id, apartment_id);

-- 5. Adicionar coluna para data de início da residência (opcional)
ALTER TABLE residents 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 6. Adicionar coluna para data de fim da residência (para histórico)
ALTER TABLE residents 
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;

-- 7. Adicionar coluna para status ativo/inativo
ALTER TABLE residents 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 8. Atualizar políticas RLS para a tabela residents
DROP POLICY IF EXISTS "Users can view their own residence" ON residents;
DROP POLICY IF EXISTS "Admins can manage all residences" ON residents;
DROP POLICY IF EXISTS "Porteiros can view residences" ON residents;

-- Política para usuários verem suas próprias residências
CREATE POLICY "Users can view their own residence" ON residents
    FOR SELECT USING (auth.uid() = user_id);

-- Política para administradores gerenciarem todas as residências
CREATE POLICY "Admins can manage all residences" ON residents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.user_type = 'admin'
        )
    );

-- Política para porteiros visualizarem residências
CREATE POLICY "Porteiros can view residences" ON residents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.user_type IN ('admin', 'porteiro')
        )
    );

-- 9. Criar função para obter moradores de um apartamento
CREATE OR REPLACE FUNCTION get_apartment_residents(apartment_uuid UUID)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    user_email TEXT,
    user_phone TEXT,
    is_owner BOOLEAN,
    is_active BOOLEAN,
    start_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.user_id,
        p.name as user_name,
        p.email as user_email,
        p.phone as user_phone,
        r.is_owner,
        r.is_active,
        r.start_date
    FROM residents r
    JOIN profiles p ON r.user_id = p.id
    WHERE r.apartment_id = apartment_uuid
    AND r.is_active = true
    ORDER BY r.is_owner DESC, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Criar função para obter apartamentos de um usuário
CREATE OR REPLACE FUNCTION get_user_apartments(user_uuid UUID)
RETURNS TABLE (
    apartment_id UUID,
    apartment_number TEXT,
    building_id UUID,
    building_name TEXT,
    is_owner BOOLEAN,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.apartment_id,
        a.number as apartment_number,
        a.building_id,
        b.name as building_name,
        r.is_owner,
        r.is_active
    FROM residents r
    JOIN apartments a ON r.apartment_id = a.id
    LEFT JOIN buildings b ON a.building_id = b.id
    WHERE r.user_id = user_uuid
    AND r.is_active = true
    ORDER BY r.is_owner DESC, a.number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Conceder permissões nas funções
GRANT EXECUTE ON FUNCTION get_apartment_residents(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_apartments(UUID) TO authenticated;

-- 12. Comentários para documentação
COMMENT ON TABLE residents IS 'Tabela de relacionamento N:N entre usuários e apartamentos, permitindo múltiplos moradores por apartamento';
COMMENT ON COLUMN residents.is_owner IS 'Indica se o morador é proprietário do apartamento';
COMMENT ON COLUMN residents.is_active IS 'Indica se a residência está ativa (para controle de histórico)';
COMMENT ON COLUMN residents.start_date IS 'Data de início da residência';
COMMENT ON COLUMN residents.end_date IS 'Data de fim da residência (para histórico)';