-- Reestruturação da tabela visitor_logs para separar registros de entrada e saída
-- Adiciona campo tipo_log (IN/OUT), visit_session_id e renomeia entry_time para log_time

-- Primeiro, criar uma tabela temporária com a nova estrutura
CREATE TABLE visitor_logs_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID NOT NULL REFERENCES visitors(id),
    apartment_id UUID NOT NULL REFERENCES apartments(id),
    building_id UUID NOT NULL REFERENCES buildings(id),
    log_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    tipo_log VARCHAR(3) NOT NULL CHECK (tipo_log IN ('IN', 'OUT')),
    visit_session_id UUID NOT NULL,
    purpose TEXT,
    authorized_by UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migrar dados existentes - criar registros IN baseados em entry_time
INSERT INTO visitor_logs_new (
    visitor_id,
    apartment_id,
    building_id,
    log_time,
    tipo_log,
    visit_session_id,
    purpose,
    authorized_by,
    status,
    created_at
)
SELECT 
    visitor_id,
    apartment_id,
    building_id,
    entry_time as log_time,
    'IN' as tipo_log,
    gen_random_uuid() as visit_session_id,
    purpose,
    authorized_by,
    status,
    created_at
FROM visitor_logs;

-- Migrar dados existentes - criar registros OUT baseados em exit_time quando não nulo
INSERT INTO visitor_logs_new (
    visitor_id,
    apartment_id,
    building_id,
    log_time,
    tipo_log,
    visit_session_id,
    purpose,
    authorized_by,
    status,
    created_at
)
SELECT 
    vl.visitor_id,
    vl.apartment_id,
    vl.building_id,
    vl.exit_time as log_time,
    'OUT' as tipo_log,
    vln.visit_session_id, -- Usar o mesmo visit_session_id do registro IN correspondente
    vl.purpose,
    vl.authorized_by,
    'completed' as status, -- Registros de saída são considerados completos
    vl.exit_time as created_at
FROM visitor_logs vl
JOIN visitor_logs_new vln ON (
    vln.visitor_id = vl.visitor_id 
    AND vln.apartment_id = vl.apartment_id 
    AND vln.building_id = vl.building_id
    AND vln.log_time = vl.entry_time
    AND vln.tipo_log = 'IN'
)
WHERE vl.exit_time IS NOT NULL;

-- Remover a tabela original
DROP TABLE visitor_logs;

-- Renomear a nova tabela
ALTER TABLE visitor_logs_new RENAME TO visitor_logs;

-- Recriar índices para performance
CREATE INDEX idx_visitor_logs_visitor_id ON visitor_logs(visitor_id);
CREATE INDEX idx_visitor_logs_apartment_id ON visitor_logs(apartment_id);
CREATE INDEX idx_visitor_logs_building_id ON visitor_logs(building_id);
CREATE INDEX idx_visitor_logs_log_time ON visitor_logs(log_time);
CREATE INDEX idx_visitor_logs_tipo_log ON visitor_logs(tipo_log);
CREATE INDEX idx_visitor_logs_visit_session_id ON visitor_logs(visit_session_id);
CREATE INDEX idx_visitor_logs_status ON visitor_logs(status);

-- Habilitar RLS na nova tabela
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;

-- Recriar políticas RLS (assumindo que existiam políticas similares)
CREATE POLICY "Administradores podem ver logs dos seus prédios" ON visitor_logs
    FOR SELECT USING (
        building_id IN (
            SELECT ba.building_id 
            FROM building_admins ba
            JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
            WHERE ap.user_id = auth.uid()
        )
        OR
        building_id IN (
            SELECT p.building_id
            FROM profiles p
            WHERE p.user_id = auth.uid() AND p.role = 'admin'
        )
    );

CREATE POLICY "Administradores podem inserir logs nos seus prédios" ON visitor_logs
    FOR INSERT WITH CHECK (
        building_id IN (
            SELECT ba.building_id 
            FROM building_admins ba
            JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
            WHERE ap.user_id = auth.uid()
        )
        OR
        building_id IN (
            SELECT p.building_id
            FROM profiles p
            WHERE p.user_id = auth.uid() AND p.role = 'admin'
        )
    );

CREATE POLICY "Administradores podem atualizar logs dos seus prédios" ON visitor_logs
    FOR UPDATE USING (
        building_id IN (
            SELECT ba.building_id 
            FROM building_admins ba
            JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
            WHERE ap.user_id = auth.uid()
        )
        OR
        building_id IN (
            SELECT p.building_id
            FROM profiles p
            WHERE p.user_id = auth.uid() AND p.role = 'admin'
        )
    );

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE ON visitor_logs TO authenticated;
GRANT SELECT ON visitor_logs TO anon;

-- Comentário na tabela
COMMENT ON TABLE visitor_logs IS 'Registro de visitas aos apartamentos - entrada e saída em registros separados';
COMMENT ON COLUMN visitor_logs.tipo_log IS 'Tipo de registro: IN para entrada, OUT para saída';
COMMENT ON COLUMN visitor_logs.visit_session_id IS 'ID da sessão de visita para agrupar entrada e saída';
COMMENT ON COLUMN visitor_logs.log_time IS 'Timestamp do registro (entrada ou saída)';