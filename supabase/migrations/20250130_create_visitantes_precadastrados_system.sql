-- Migração para Sistema de Visitantes Pré-cadastrados
-- Data: 2025-01-30
-- Descrição: Criação das tabelas visitantes_precadastrados e visitante_acessos

-- Tabela de visitantes pré-cadastrados
CREATE TABLE IF NOT EXISTS visitantes_precadastrados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    documento VARCHAR(20) NOT NULL,
    telefone VARCHAR(20),
    foto_url TEXT,
    motivo_visita TEXT NOT NULL,
    tipo_acesso VARCHAR(20) CHECK (tipo_acesso IN ('direto', 'aprovacao')) DEFAULT 'aprovacao',
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    morador_id UUID REFERENCES auth.users(id) NOT NULL,
    apartamento VARCHAR(10) NOT NULL,
    qr_code VARCHAR(255) UNIQUE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (data_fim >= data_inicio)
);

-- Criar índices para visitantes pré-cadastrados
CREATE INDEX IF NOT EXISTS idx_visitantes_morador_id ON visitantes_precadastrados(morador_id);
CREATE INDEX IF NOT EXISTS idx_visitantes_documento ON visitantes_precadastrados(documento);
CREATE INDEX IF NOT EXISTS idx_visitantes_data_validade ON visitantes_precadastrados(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_visitantes_qr_code ON visitantes_precadastrados(qr_code);
CREATE INDEX IF NOT EXISTS idx_visitantes_ativo ON visitantes_precadastrados(ativo);
CREATE INDEX IF NOT EXISTS idx_visitantes_apartamento ON visitantes_precadastrados(apartamento);
CREATE INDEX IF NOT EXISTS idx_visitantes_tipo_acesso ON visitantes_precadastrados(tipo_acesso);

-- Tabela de acessos de visitantes
CREATE TABLE IF NOT EXISTS visitante_acessos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitante_id UUID REFERENCES visitantes_precadastrados(id) ON DELETE CASCADE,
    data_acesso TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tipo_liberacao VARCHAR(20) CHECK (tipo_liberacao IN ('automatica', 'manual', 'aprovada', 'negada')) NOT NULL,
    liberado_por UUID REFERENCES auth.users(id),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para acessos
CREATE INDEX IF NOT EXISTS idx_visitante_acessos_visitante_id ON visitante_acessos(visitante_id);
CREATE INDEX IF NOT EXISTS idx_visitante_acessos_data_acesso ON visitante_acessos(data_acesso);
CREATE INDEX IF NOT EXISTS idx_visitante_acessos_tipo_liberacao ON visitante_acessos(tipo_liberacao);
CREATE INDEX IF NOT EXISTS idx_visitante_acessos_liberado_por ON visitante_acessos(liberado_por);

-- Habilitar Row Level Security
ALTER TABLE visitantes_precadastrados ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitante_acessos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para visitantes pré-cadastrados
-- Moradores podem gerenciar seus próprios visitantes
CREATE POLICY "Moradores podem gerenciar seus visitantes" ON visitantes_precadastrados
    FOR ALL USING (auth.uid() = morador_id);

-- Porteiros podem visualizar visitantes ativos e válidos
CREATE POLICY "Porteiros podem visualizar visitantes ativos" ON visitantes_precadastrados
    FOR SELECT USING (
        ativo = true 
        AND CURRENT_DATE BETWEEN data_inicio AND data_fim
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.user_type = 'porteiro'
        )
    );

-- Administradores podem ver todos os visitantes
CREATE POLICY "Administradores podem ver todos visitantes" ON visitantes_precadastrados
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.user_type IN ('admin', 'super_admin')
        )
    );

-- Políticas RLS para acessos de visitantes
-- Moradores podem ver acessos de seus visitantes
CREATE POLICY "Moradores podem ver acessos de seus visitantes" ON visitante_acessos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM visitantes_precadastrados 
            WHERE visitantes_precadastrados.id = visitante_acessos.visitante_id 
            AND visitantes_precadastrados.morador_id = auth.uid()
        )
    );

-- Porteiros podem inserir e ver todos os acessos
CREATE POLICY "Porteiros podem gerenciar acessos" ON visitante_acessos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.user_type = 'porteiro'
        )
    );

-- Administradores podem ver todos os acessos
CREATE POLICY "Administradores podem ver todos acessos" ON visitante_acessos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.user_type IN ('admin', 'super_admin')
        )
    );

-- Função para gerar QR Code único
CREATE OR REPLACE FUNCTION generate_qr_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.qr_code := 'VIS_' || UPPER(SUBSTRING(NEW.id::text, 1, 8)) || '_' || EXTRACT(EPOCH FROM NOW())::bigint;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar QR Code automaticamente
CREATE TRIGGER trigger_generate_qr_code
    BEFORE INSERT ON visitantes_precadastrados
    FOR EACH ROW
    EXECUTE FUNCTION generate_qr_code();

-- Trigger para atualizar updated_at na tabela visitantes_precadastrados
CREATE TRIGGER update_visitantes_updated_at
    BEFORE UPDATE ON visitantes_precadastrados
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para verificar se visitante está válido
CREATE OR REPLACE FUNCTION is_visitante_valid(visitante_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    visitante_record RECORD;
BEGIN
    SELECT ativo, data_inicio, data_fim 
    INTO visitante_record 
    FROM visitantes_precadastrados 
    WHERE id = visitante_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    RETURN visitante_record.ativo = true 
           AND CURRENT_DATE BETWEEN visitante_record.data_inicio AND visitante_record.data_fim;
END;
$$ LANGUAGE plpgsql;

-- Função para registrar acesso de visitante
CREATE OR REPLACE FUNCTION registrar_acesso_visitante(
    p_visitante_id UUID,
    p_tipo_liberacao VARCHAR(20),
    p_liberado_por UUID DEFAULT NULL,
    p_observacoes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    novo_acesso_id UUID;
BEGIN
    -- Verificar se o visitante é válido
    IF NOT is_visitante_valid(p_visitante_id) THEN
        RAISE EXCEPTION 'Visitante não está válido ou ativo';
    END IF;
    
    -- Inserir o registro de acesso
    INSERT INTO visitante_acessos (visitante_id, tipo_liberacao, liberado_por, observacoes)
    VALUES (p_visitante_id, p_tipo_liberacao, p_liberado_por, p_observacoes)
    RETURNING id INTO novo_acesso_id;
    
    RETURN novo_acesso_id;
END;
$$ LANGUAGE plpgsql;

-- Conceder permissões básicas
GRANT SELECT, INSERT, UPDATE, DELETE ON visitantes_precadastrados TO authenticated;
GRANT SELECT, INSERT, UPDATE ON visitante_acessos TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Permitir acesso anônimo para consulta de visitantes por QR code (para porteiros)
GRANT SELECT ON visitantes_precadastrados TO anon;

-- Inserir dados de exemplo
INSERT INTO visitantes_precadastrados (nome, documento, telefone, motivo_visita, tipo_acesso, data_inicio, data_fim, morador_id, apartamento) 
SELECT 
    'João Silva',
    '12345678901',
    '(11) 99999-9999',
    'Visita social',
    'aprovacao',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days',
    id,
    '101'
FROM auth.users 
WHERE email LIKE '%morador%' 
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO visitantes_precadastrados (nome, documento, telefone, motivo_visita, tipo_acesso, data_inicio, data_fim, morador_id, apartamento) 
SELECT 
    'Maria Santos',
    '98765432109',
    '(11) 88888-8888',
    'Prestação de serviços',
    'direto',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    id,
    '102'
FROM auth.users 
WHERE email LIKE '%morador%' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE visitantes_precadastrados IS 'Tabela para armazenar visitantes pré-cadastrados pelos moradores';
COMMENT ON TABLE visitante_acessos IS 'Tabela para registrar todos os acessos dos visitantes pré-cadastrados';
COMMENT ON COLUMN visitantes_precadastrados.tipo_acesso IS 'Tipo de acesso: direto (sem aprovação) ou aprovacao (requer aprovação do morador)';
COMMENT ON COLUMN visitantes_precadastrados.qr_code IS 'Código QR único gerado automaticamente para identificação rápida';
COMMENT ON COLUMN visitante_acessos.tipo_liberacao IS 'Tipo de liberação: automatica, manual, aprovada, negada';
COMMENT ON FUNCTION is_visitante_valid(UUID) IS 'Função para verificar se um visitante está ativo e dentro do período de validade';
COMMENT ON FUNCTION registrar_acesso_visitante(UUID, VARCHAR, UUID, TEXT) IS 'Função para registrar um acesso de visitante com validações';