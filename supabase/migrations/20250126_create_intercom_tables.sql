-- Criar tabelas para sistema de interfone com Twilio
-- Baseado na arquitetura técnica documentada

-- Tabela de Chamadas de Interfone (intercom_calls)
CREATE TABLE IF NOT EXISTS intercom_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id UUID NOT NULL REFERENCES apartments(id),
    doorman_id UUID NOT NULL REFERENCES profiles(id),
    status VARCHAR(20) DEFAULT 'calling' CHECK (status IN ('calling', 'answered', 'ended', 'missed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    twilio_conference_sid VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_intercom_calls_apartment_id ON intercom_calls(apartment_id);
CREATE INDEX IF NOT EXISTS idx_intercom_calls_doorman_id ON intercom_calls(doorman_id);
CREATE INDEX IF NOT EXISTS idx_intercom_calls_started_at ON intercom_calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_intercom_calls_status ON intercom_calls(status);

-- Tabela de Participantes da Chamada (call_participants)
CREATE TABLE IF NOT EXISTS call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES intercom_calls(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES profiles(id),
    status VARCHAR(20) DEFAULT 'notified' CHECK (status IN ('notified', 'answered', 'declined', 'missed')),
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para call_participants
CREATE INDEX IF NOT EXISTS idx_call_participants_call_id ON call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_resident_id ON call_participants(resident_id);

-- Atualizar tabela profiles para tokens de notificação push
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS apns_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true;

-- Criar índices para tokens de notificação
CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token ON profiles(fcm_token);
CREATE INDEX IF NOT EXISTS idx_profiles_apns_token ON profiles(apns_token);

-- Habilitar RLS (Row Level Security)
ALTER TABLE intercom_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para intercom_calls
-- Porteiros podem criar e ver suas próprias chamadas
CREATE POLICY "Doormen can manage their calls" ON intercom_calls
    FOR ALL USING (doorman_id = auth.uid());

-- Moradores podem ver chamadas do seu apartamento
CREATE POLICY "Residents can view apartment calls" ON intercom_calls
    FOR SELECT USING (
        apartment_id IN (
            SELECT apartment_id FROM apartment_residents 
            WHERE profile_id = auth.uid()
        )
    );

-- Políticas RLS para call_participants
-- Moradores podem ver suas próprias participações
CREATE POLICY "Residents can view their participations" ON call_participants
    FOR SELECT USING (resident_id = auth.uid());

-- Sistema pode inserir participações (para o backend)
CREATE POLICY "System can manage participations" ON call_participants
    FOR ALL USING (true);

-- Dados iniciais de exemplo (opcional)
-- Comentado para evitar conflitos em produção
/*
INSERT INTO intercom_calls (apartment_id, doorman_id, status, started_at, ended_at, duration_seconds)
VALUES 
    ('apartment_uuid_1', 'doorman_uuid_1', 'ended', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '58 minutes', 120),
    ('apartment_uuid_2', 'doorman_uuid_1', 'missed', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', 0);
*/