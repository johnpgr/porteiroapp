-- Adicionar 'prestador_servico' ao enum visit_type_enum
-- Esta migração adiciona o novo tipo de visita 'prestador_servico' ao enum existente

-- Primeiro, verificar se o enum existe e adicionar o novo valor
DO $$
BEGIN
    -- Verificar se o tipo enum existe
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_type_enum') THEN
        -- Adicionar o novo valor ao enum existente
        ALTER TYPE visit_type_enum ADD VALUE IF NOT EXISTS 'prestador_servico';
    ELSE
        -- Se o enum não existir, criar com todos os valores
        CREATE TYPE visit_type_enum AS ENUM ('pontual', 'frequente', 'prestador_servico');
    END IF;
END $$;

-- Atualizar a tabela visitors para usar o enum (se ainda não estiver usando)
-- Isso garante que a coluna visit_type use o enum correto
DO $$
BEGIN
    -- Verificar se a coluna já usa o enum
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'visitors' 
        AND column_name = 'visit_type' 
        AND udt_name = 'visit_type_enum'
    ) THEN
        -- Alterar a coluna para usar o enum
        ALTER TABLE visitors 
        ALTER COLUMN visit_type TYPE visit_type_enum 
        USING visit_type::visit_type_enum;
    END IF;
END $$;

-- Comentário explicativo
COMMENT ON TYPE visit_type_enum IS 'Tipos de visita válidos: pontual, frequente, prestador_servico';