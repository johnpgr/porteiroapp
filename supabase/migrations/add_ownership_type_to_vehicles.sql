-- Migração: Adicionar campo ownership_type na tabela vehicles
-- Data: 2024-01-XX
-- Descrição: Adiciona campo para distinguir entre veículos de visita e veículos pessoais

-- Adicionar coluna ownership_type
ALTER TABLE vehicles 
ADD COLUMN ownership_type VARCHAR(20) NOT NULL DEFAULT 'proprietario' 
CHECK (ownership_type IN ('visita', 'proprietario'));

-- Criar índice para otimizar consultas por tipo de propriedade
CREATE INDEX idx_vehicles_ownership_type ON vehicles(ownership_type);

-- Comentário da coluna
COMMENT ON COLUMN vehicles.ownership_type IS 'Tipo de propriedade do veículo: visita ou proprietario';