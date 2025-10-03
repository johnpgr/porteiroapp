-- Migration: Create WebRTC Tables for James Avisa
-- Description: Creates all necessary tables for WebRTC calling functionality
-- Integrates with existing profiles, apartments, and apartment_residents tables

-- Adicionar campos WebRTC na tabela profiles existente
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Criar índices para campos WebRTC na tabela profiles
CREATE INDEX IF NOT EXISTS idx_profiles_webrtc_online_available ON profiles(is_online, is_available);
CREATE INDEX IF NOT EXISTS idx_profiles_webrtc_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_webrtc_building ON profiles(building_id);

-- Tabela de Chamadas WebRTC (usando profiles em vez de webrtc_users)
CREATE TABLE webrtc_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES profiles(id),
    receiver_id UUID NOT NULL REFERENCES profiles(id),
    apartment_id UUID REFERENCES apartments(id),
    status VARCHAR(20) DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'ended', 'missed', 'rejected')),
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    end_reason VARCHAR(50),
    webrtc_stats JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para webrtc_calls
CREATE INDEX idx_webrtc_calls_caller ON webrtc_calls(caller_id);
CREATE INDEX idx_webrtc_calls_receiver ON webrtc_calls(receiver_id);
CREATE INDEX idx_webrtc_calls_status ON webrtc_calls(status);
CREATE INDEX idx_webrtc_calls_initiated_at ON webrtc_calls(initiated_at DESC);

-- Tabela de Tokens de Dispositivo WebRTC (usando profiles)
CREATE TABLE webrtc_device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para webrtc_device_tokens
CREATE INDEX idx_webrtc_device_tokens_profile ON webrtc_device_tokens(profile_id);
CREATE INDEX idx_webrtc_device_tokens_active ON webrtc_device_tokens(is_active);
CREATE UNIQUE INDEX idx_webrtc_device_tokens_unique ON webrtc_device_tokens(profile_id, token);

-- Tabela de Eventos de Chamada WebRTC
CREATE TABLE webrtc_call_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES webrtc_calls(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para webrtc_call_events
CREATE INDEX idx_webrtc_call_events_call ON webrtc_call_events(call_id);
CREATE INDEX idx_webrtc_call_events_type ON webrtc_call_events(event_type);
CREATE INDEX idx_webrtc_call_events_created_at ON webrtc_call_events(created_at DESC);

-- Configurar RLS (Row Level Security) para tabelas WebRTC
ALTER TABLE webrtc_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE webrtc_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE webrtc_call_events ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança WebRTC
CREATE POLICY "WebRTC users can view calls they participate" ON webrtc_calls
    FOR SELECT USING (
        caller_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR 
        receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "WebRTC users can manage own tokens" ON webrtc_device_tokens
    FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Conceder permissões básicas para role anon (necessário para webhooks)
GRANT SELECT ON profiles TO anon;
GRANT SELECT ON webrtc_calls TO anon;
GRANT SELECT ON apartments TO anon;
GRANT SELECT ON apartment_residents TO anon;

-- Conceder permissões completas para role authenticated
GRANT ALL PRIVILEGES ON profiles TO authenticated;
GRANT ALL PRIVILEGES ON webrtc_calls TO authenticated;
GRANT ALL PRIVILEGES ON webrtc_device_tokens TO authenticated;
GRANT ALL PRIVILEGES ON webrtc_call_events TO authenticated;
GRANT ALL PRIVILEGES ON apartments TO authenticated;
GRANT ALL PRIVILEGES ON apartment_residents TO authenticated;

-- Permissões específicas para integração com sistema existente
-- Permitir que o sistema de visitantes acesse dados de moradores WebRTC
GRANT SELECT ON profiles TO service_role;
GRANT SELECT ON apartments TO service_role;
GRANT SELECT ON apartment_residents TO service_role;
GRANT INSERT, UPDATE ON webrtc_calls TO service_role;

-- Criar função para buscar moradores de um apartamento
CREATE OR REPLACE FUNCTION get_apartment_residents(apartment_number TEXT, building_id UUID)
RETURNS TABLE (
    profile_id UUID,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    is_online BOOLEAN,
    is_available BOOLEAN,
    is_primary BOOLEAN,
    is_owner BOOLEAN,
    relationship TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as profile_id,
        p.full_name,
        p.phone,
        p.email,
        p.is_online,
        p.is_available,
        ar.is_primary,
        ar.is_owner,
        ar.relationship
    FROM profiles p
    JOIN apartment_residents ar ON p.id = ar.profile_id
    JOIN apartments a ON ar.apartment_id = a.id
    WHERE a.number = apartment_number 
    AND a.building_id = building_id
    AND ar.is_active = true
    ORDER BY ar.is_primary DESC, ar.is_owner DESC;
END;
$$ LANGUAGE plpgsql;

-- Comentários de documentação
COMMENT ON TABLE webrtc_calls IS 'Registro de todas as chamadas WebRTC realizadas no sistema - integrado com profiles e apartments';
COMMENT ON TABLE webrtc_device_tokens IS 'Tokens de dispositivos para notificações push WebRTC - integrado com profiles';
COMMENT ON TABLE webrtc_call_events IS 'Log de eventos durante chamadas WebRTC para auditoria';
COMMENT ON FUNCTION get_apartment_residents IS 'Função para buscar todos os moradores ativos de um apartamento específico';