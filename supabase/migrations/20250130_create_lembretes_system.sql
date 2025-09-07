-- Migração para Sistema de Lembretes do Síndico
-- Data: 2025-01-30
-- Descrição: Criação das tabelas lembretes e lembrete_historico

-- Criar tabela de lembretes
CREATE TABLE IF NOT EXISTS lembretes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_vencimento TIMESTAMP WITH TIME ZONE NOT NULL,
    prioridade VARCHAR(20) CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')) DEFAULT 'media',
    categoria VARCHAR(100) NOT NULL,
    antecedencia_alerta INTEGER DEFAULT 60, -- minutos
    sindico_id UUID REFERENCES auth.users(id) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pendente', 'concluido', 'cancelado')) DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_lembretes_sindico_id ON lembretes(sindico_id);
CREATE INDEX IF NOT EXISTS idx_lembretes_data_vencimento ON lembretes(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_lembretes_status ON lembretes(status);
CREATE INDEX IF NOT EXISTS idx_lembretes_prioridade ON lembretes(prioridade);
CREATE INDEX IF NOT EXISTS idx_lembretes_categoria ON lembretes(categoria);

-- Tabela de histórico de lembretes
CREATE TABLE IF NOT EXISTS lembrete_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lembrete_id UUID REFERENCES lembretes(id) ON DELETE CASCADE,
    acao VARCHAR(50) NOT NULL, -- 'criado', 'editado', 'concluido', 'cancelado'
    data_acao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usuario_id UUID REFERENCES auth.users(id),
    observacoes TEXT
);

-- Criar índice para histórico
CREATE INDEX IF NOT EXISTS idx_lembrete_historico_lembrete_id ON lembrete_historico(lembrete_id);
CREATE INDEX IF NOT EXISTS idx_lembrete_historico_data_acao ON lembrete_historico(data_acao);

-- Habilitar Row Level Security
ALTER TABLE lembretes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lembrete_historico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para lembretes
-- Síndicos podem gerenciar seus próprios lembretes
CREATE POLICY "Síndicos podem gerenciar seus lembretes" ON lembretes
    FOR ALL USING (auth.uid() = sindico_id);

-- Políticas RLS para histórico de lembretes
-- Usuários podem ver histórico dos lembretes que têm acesso
CREATE POLICY "Usuários podem ver histórico de seus lembretes" ON lembrete_historico
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lembretes 
            WHERE lembretes.id = lembrete_historico.lembrete_id 
            AND lembretes.sindico_id = auth.uid()
        )
    );

-- Usuários podem inserir no histórico dos lembretes que têm acesso
CREATE POLICY "Usuários podem inserir histórico de seus lembretes" ON lembrete_historico
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM lembretes 
            WHERE lembretes.id = lembrete_historico.lembrete_id 
            AND lembretes.sindico_id = auth.uid()
        )
    );

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at na tabela lembretes
CREATE TRIGGER update_lembretes_updated_at
    BEFORE UPDATE ON lembretes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para criar entrada no histórico automaticamente
CREATE OR REPLACE FUNCTION create_lembrete_historico()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO lembrete_historico (lembrete_id, acao, usuario_id, observacoes)
        VALUES (NEW.id, 'criado', auth.uid(), 'Lembrete criado');
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Verificar se o status mudou
        IF OLD.status != NEW.status THEN
            INSERT INTO lembrete_historico (lembrete_id, acao, usuario_id, observacoes)
            VALUES (NEW.id, NEW.status, auth.uid(), 'Status alterado para ' || NEW.status);
        ELSE
            INSERT INTO lembrete_historico (lembrete_id, acao, usuario_id, observacoes)
            VALUES (NEW.id, 'editado', auth.uid(), 'Lembrete editado');
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar histórico automaticamente
CREATE TRIGGER trigger_create_lembrete_historico
    AFTER INSERT OR UPDATE ON lembretes
    FOR EACH ROW
    EXECUTE FUNCTION create_lembrete_historico();

-- Conceder permissões básicas para roles anon e authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON lembretes TO authenticated;
GRANT SELECT, INSERT ON lembrete_historico TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Inserir dados de exemplo (opcional)
INSERT INTO lembretes (titulo, descricao, data_vencimento, categoria, prioridade, sindico_id) 
SELECT 
    'Limpeza da Caixa D''Água',
    'Limpeza semestral obrigatória da caixa d''água do prédio',
    NOW() + INTERVAL '30 days',
    'Manutenção',
    'alta',
    id
FROM auth.users 
WHERE email LIKE '%admin%' 
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO lembretes (titulo, descricao, data_vencimento, categoria, prioridade, sindico_id) 
SELECT 
    'Reunião de Condomínio',
    'Reunião mensal para discussão de assuntos do condomínio',
    NOW() + INTERVAL '15 days',
    'Administrativo',
    'media',
    id
FROM auth.users 
WHERE email LIKE '%admin%' 
LIMIT 1
ON CONFLICT DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE lembretes IS 'Tabela para armazenar lembretes do síndico';
COMMENT ON TABLE lembrete_historico IS 'Tabela para armazenar histórico de ações nos lembretes';
COMMENT ON COLUMN lembretes.antecedencia_alerta IS 'Tempo em minutos para envio de alerta antes do vencimento';
COMMENT ON COLUMN lembretes.prioridade IS 'Nível de prioridade: baixa, media, alta, urgente';
COMMENT ON COLUMN lembretes.status IS 'Status do lembrete: pendente, concluido, cancelado';