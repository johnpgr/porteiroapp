-- Migração para adicionar campos faltantes na tabela deliveries
-- Data: 2024-12-21
-- Objetivo: Adicionar colunas delivery_company, recipient_name, received_at, notes

-- Verificar se a coluna delivery_company existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'deliveries' AND column_name = 'delivery_company') THEN
        ALTER TABLE deliveries ADD COLUMN delivery_company VARCHAR(100);
    END IF;
END $$;

-- Verificar se a coluna recipient_name existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'deliveries' AND column_name = 'recipient_name') THEN
        ALTER TABLE deliveries ADD COLUMN recipient_name VARCHAR(100);
    END IF;
END $$;

-- Verificar se a coluna received_at existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'deliveries' AND column_name = 'received_at') THEN
        ALTER TABLE deliveries ADD COLUMN received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Verificar se a coluna notes existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'deliveries' AND column_name = 'notes') THEN
        ALTER TABLE deliveries ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Verificar se a coluna description existe, se não, adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'deliveries' AND column_name = 'description') THEN
        ALTER TABLE deliveries ADD COLUMN description TEXT;
    END IF;
END $$;

-- Comentário: Campos adicionados para suportar funcionalidade completa de registro de encomendas
-- delivery_company: empresa de entrega (iFood, Rappi, Correios, etc.)
-- recipient_name: nome do destinatário
-- received_at: timestamp de quando a encomenda foi recebida
-- notes: observações adicionais
-- description: descrição da encomenda