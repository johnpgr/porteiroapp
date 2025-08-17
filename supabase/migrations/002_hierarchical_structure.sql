-- =====================================================
-- MIGRAÇÃO 002: ESTRUTURA HIERÁRQUICA
-- Condomínio > Prédios > Apartamentos > Morador
-- =====================================================

-- 1. CRIAR TABELA DE CONDOMÍNIOS
CREATE TABLE condominiums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    admin_id UUID, -- Será preenchido após criar usuários
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CRIAR TABELA DE PRÉDIOS
CREATE TABLE buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    condominium_id UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    address TEXT,
    floors INTEGER DEFAULT 1,
    apartments_per_floor INTEGER DEFAULT 1,
    porteiro_id UUID, -- Será preenchido após criar usuários
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ATUALIZAR TABELA DE APARTAMENTOS
ALTER TABLE apartments ADD COLUMN condominium_id UUID;
ALTER TABLE apartments ADD COLUMN floor INTEGER;
ALTER TABLE apartments ADD COLUMN is_occupied BOOLEAN DEFAULT FALSE;
ALTER TABLE apartments DROP COLUMN building;

-- Primeiro, vamos atualizar os dados existentes antes de adicionar constraints
-- (isso será feito na seção de dados de exemplo)

-- Adicionar constraints (será feito após atualizar os dados)

-- 4. ATUALIZAR TABELA DE USUÁRIOS
ALTER TABLE users ADD COLUMN condominium_id UUID;
ALTER TABLE users ADD COLUMN building_id UUID;
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Adicionar constraints
ALTER TABLE users ADD CONSTRAINT fk_users_condominium 
    FOREIGN KEY (condominium_id) REFERENCES condominiums(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_building 
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL;

-- 5. ATUALIZAR TABELA DE RESIDENTES
ALTER TABLE residents ADD COLUMN condominium_id UUID;
ALTER TABLE residents ADD COLUMN building_id UUID;
ALTER TABLE residents ADD COLUMN move_in_date DATE;
ALTER TABLE residents ADD COLUMN move_out_date DATE;
ALTER TABLE residents ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Adicionar constraints
ALTER TABLE residents ADD CONSTRAINT fk_residents_condominium 
    FOREIGN KEY (condominium_id) REFERENCES condominiums(id) ON DELETE CASCADE;
ALTER TABLE residents ADD CONSTRAINT fk_residents_building 
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;

-- 6. ATUALIZAR TABELA DE VISITANTES
ALTER TABLE visitors ADD COLUMN condominium_id UUID;
ALTER TABLE visitors ADD COLUMN building_id UUID;
ALTER TABLE visitors ADD COLUMN visitor_phone VARCHAR(20);
ALTER TABLE visitors ADD COLUMN visitor_document VARCHAR(20);
ALTER TABLE visitors ADD COLUMN entry_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE visitors ADD COLUMN exit_time TIMESTAMP WITH TIME ZONE;

-- Adicionar constraints
ALTER TABLE visitors ADD CONSTRAINT fk_visitors_condominium 
    FOREIGN KEY (condominium_id) REFERENCES condominiums(id) ON DELETE CASCADE;
ALTER TABLE visitors ADD CONSTRAINT fk_visitors_building 
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;

-- 7. ATUALIZAR TABELA DE ENCOMENDAS
ALTER TABLE deliveries ADD COLUMN condominium_id UUID;
ALTER TABLE deliveries ADD COLUMN building_id UUID;
ALTER TABLE deliveries ADD COLUMN sender_name VARCHAR(100);
ALTER TABLE deliveries ADD COLUMN delivery_date DATE;

-- Adicionar constraints
ALTER TABLE deliveries ADD CONSTRAINT fk_deliveries_condominium 
    FOREIGN KEY (condominium_id) REFERENCES condominiums(id) ON DELETE CASCADE;
ALTER TABLE deliveries ADD CONSTRAINT fk_deliveries_building 
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;

-- 8. ATUALIZAR TABELA DE COMUNICAÇÕES
ALTER TABLE communications ADD COLUMN condominium_id UUID;
ALTER TABLE communications ADD COLUMN building_id UUID;

-- Adicionar constraints
ALTER TABLE communications ADD CONSTRAINT fk_communications_condominium 
    FOREIGN KEY (condominium_id) REFERENCES condominiums(id) ON DELETE CASCADE;
ALTER TABLE communications ADD CONSTRAINT fk_communications_building 
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;

-- 9. ATUALIZAR TABELA DE LOGS
ALTER TABLE visitor_logs ADD COLUMN condominium_id UUID;
ALTER TABLE visitor_logs ADD COLUMN building_id UUID;

-- Adicionar constraints
ALTER TABLE visitor_logs ADD CONSTRAINT fk_visitor_logs_condominium 
    FOREIGN KEY (condominium_id) REFERENCES condominiums(id) ON DELETE CASCADE;
ALTER TABLE visitor_logs ADD CONSTRAINT fk_visitor_logs_building 
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;

-- 10. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_condominiums_name ON condominiums(name);
CREATE INDEX idx_buildings_condominium ON buildings(condominium_id);
CREATE INDEX idx_buildings_name ON buildings(name);
CREATE INDEX idx_apartments_condominium ON apartments(condominium_id);
CREATE INDEX idx_apartments_building_floor ON apartments(building_id, floor);
CREATE INDEX idx_users_condominium ON users(condominium_id);
CREATE INDEX idx_users_building ON users(building_id);
CREATE INDEX idx_residents_condominium ON residents(condominium_id);
CREATE INDEX idx_residents_building ON residents(building_id);
CREATE INDEX idx_visitors_condominium ON visitors(condominium_id);
CREATE INDEX idx_visitors_building ON visitors(building_id);
CREATE INDEX idx_deliveries_condominium ON deliveries(condominium_id);
CREATE INDEX idx_deliveries_building ON deliveries(building_id);

-- 11. FUNÇÃO PARA ATUALIZAR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 12. CRIAR TRIGGERS PARA updated_at
CREATE TRIGGER update_condominiums_updated_at BEFORE UPDATE ON condominiums
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON buildings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. HABILITAR ROW LEVEL SECURITY
ALTER TABLE condominiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- 14. POLÍTICAS RLS PARA CONDOMINIUMS
CREATE POLICY "Admins can view their condominium" ON condominiums
    FOR SELECT USING (
        auth.uid() IN (
            SELECT u.id FROM users u 
            WHERE u.user_type = 'admin' AND u.condominium_id = condominiums.id
        )
    );

CREATE POLICY "Admins can update their condominium" ON condominiums
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT u.id FROM users u 
            WHERE u.user_type = 'admin' AND u.condominium_id = condominiums.id
        )
    );

-- 15. POLÍTICAS RLS PARA BUILDINGS
CREATE POLICY "Users can view buildings in their condominium" ON buildings
    FOR SELECT USING (
        condominium_id IN (
            SELECT u.condominium_id FROM users u WHERE u.id = auth.uid()
        )
    );

CREATE POLICY "Admins and porteiros can update buildings" ON buildings
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT u.id FROM users u 
            WHERE (u.user_type = 'admin' AND u.condominium_id = buildings.condominium_id)
               OR (u.user_type = 'porteiro' AND u.building_id = buildings.id)
        )
    );

-- 16. ATUALIZAR POLÍTICAS RLS EXISTENTES
DROP POLICY IF EXISTS "Users can view apartments" ON apartments;
CREATE POLICY "Users can view apartments in their context" ON apartments
    FOR SELECT USING (
        condominium_id IN (
            SELECT u.condominium_id FROM users u WHERE u.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can view visitors" ON visitors;
CREATE POLICY "Users can view visitors in their context" ON visitors
    FOR SELECT USING (
        condominium_id IN (
            SELECT u.condominium_id FROM users u WHERE u.id = auth.uid()
        )
    );

-- 17. CONCEDER PERMISSÕES
GRANT SELECT ON condominiums TO anon;
GRANT ALL PRIVILEGES ON condominiums TO authenticated;
GRANT SELECT ON buildings TO anon;
GRANT ALL PRIVILEGES ON buildings TO authenticated;

-- 18. DADOS DE EXEMPLO
-- Inserir condomínio exemplo
INSERT INTO condominiums (id, name, address, phone, email) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Residencial Exemplo', 'Rua das Flores, 123', '(11) 1234-5678', 'admin@residencial.com');

-- Inserir prédio exemplo
INSERT INTO buildings (id, name, condominium_id, floors, apartments_per_floor) VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'Bloco A', '550e8400-e29b-41d4-a716-446655440000', 3, 2);

-- Atualizar apartamentos existentes
UPDATE apartments SET 
    condominium_id = '550e8400-e29b-41d4-a716-446655440000'::uuid,
    building_id = '550e8400-e29b-41d4-a716-446655440001'::uuid,
    floor = CASE 
        WHEN number LIKE '1%' THEN 1
        WHEN number LIKE '2%' THEN 2
        WHEN number LIKE '3%' THEN 3
        ELSE 1
    END
WHERE building_id IS NULL;

-- Agora que os dados foram atualizados, podemos adicionar as constraints
ALTER TABLE apartments ALTER COLUMN building_id SET NOT NULL;
ALTER TABLE apartments ADD CONSTRAINT fk_apartments_building 
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE;
ALTER TABLE apartments ADD CONSTRAINT fk_apartments_condominium 
    FOREIGN KEY (condominium_id) REFERENCES condominiums(id) ON DELETE CASCADE;

-- Atualizar usuários existentes
UPDATE users SET 
    condominium_id = '550e8400-e29b-41d4-a716-446655440000'::uuid,
    building_id = CASE 
        WHEN user_type = 'porteiro' THEN '550e8400-e29b-41d4-a716-446655440001'::uuid
        ELSE NULL
    END;

-- Atualizar foreign keys nas tabelas de condomínio e prédio
UPDATE condominiums SET admin_id = (
    SELECT id FROM users WHERE user_type = 'admin' AND condominium_id = condominiums.id LIMIT 1
);

UPDATE buildings SET porteiro_id = (
    SELECT id FROM users WHERE user_type = 'porteiro' AND building_id = buildings.id LIMIT 1
);

-- Adicionar constraints finais
ALTER TABLE condominiums ADD CONSTRAINT fk_condominiums_admin 
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE buildings ADD CONSTRAINT fk_buildings_porteiro 
    FOREIGN KEY (porteiro_id) REFERENCES users(id) ON DELETE SET NULL;