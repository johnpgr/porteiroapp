-- Criar tabela de usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'porteiro', 'morador')),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de apartamentos
CREATE TABLE apartments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number VARCHAR(10) NOT NULL,
    building VARCHAR(50),
    building_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de residentes
CREATE TABLE residents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    apartment_id UUID REFERENCES apartments(id),
    is_owner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de visitantes
CREATE TABLE visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_name VARCHAR(100) NOT NULL,
    visitor_photo_url TEXT,
    apartment_id UUID REFERENCES apartments(id),
    created_by UUID REFERENCES users(id),
    visit_type VARCHAR(20) CHECK (visit_type IN ('visitor', 'delivery', 'service')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'denied', 'completed')),
    authorized BOOLEAN DEFAULT FALSE,
    authorized_by UUID REFERENCES users(id),
    visit_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de encomendas
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_photo_url TEXT,
    apartment_id UUID REFERENCES apartments(id),
    received_by UUID REFERENCES users(id),
    delivery_location VARCHAR(100),
    tracking_code VARCHAR(50),
    status VARCHAR(20) DEFAULT 'received' CHECK (status IN ('received', 'delivered', 'returned')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de comunicações
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id),
    apartment_id UUID REFERENCES apartments(id),
    message_type VARCHAR(20) CHECK (message_type IN ('aviso', 'alerta', 'comunicado')),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_general BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de logs de visitantes
CREATE TABLE visitor_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID REFERENCES visitors(id),
    action VARCHAR(50) NOT NULL,
    performed_by UUID REFERENCES users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_code ON users(code);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_apartments_number ON apartments(number);
CREATE INDEX idx_apartments_building ON apartments(building_id);
CREATE INDEX idx_visitors_apartment ON visitors(apartment_id);
CREATE INDEX idx_visitors_status ON visitors(status);
CREATE INDEX idx_visitors_created_at ON visitors(created_at DESC);
CREATE INDEX idx_deliveries_apartment ON deliveries(apartment_id);
CREATE INDEX idx_communications_apartment ON communications(apartment_id);
CREATE INDEX idx_visitor_logs_visitor ON visitor_logs(visitor_id);

-- Habilitar Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;

-- Conceder permissões básicas
GRANT SELECT ON users TO anon;
GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT SELECT ON apartments TO anon;
GRANT ALL PRIVILEGES ON apartments TO authenticated;
GRANT SELECT ON residents TO anon;
GRANT ALL PRIVILEGES ON residents TO authenticated;
GRANT SELECT ON visitors TO anon;
GRANT ALL PRIVILEGES ON visitors TO authenticated;
GRANT SELECT ON deliveries TO anon;
GRANT ALL PRIVILEGES ON deliveries TO authenticated;
GRANT SELECT ON communications TO anon;
GRANT ALL PRIVILEGES ON communications TO authenticated;
GRANT SELECT ON visitor_logs TO anon;
GRANT ALL PRIVILEGES ON visitor_logs TO authenticated;

-- Inserir dados iniciais
INSERT INTO apartments (number, building) VALUES 
('101', 'Bloco A'),
('102', 'Bloco A'),
('201', 'Bloco A'),
('202', 'Bloco A'),
('301', 'Bloco A');

-- Inserir usuário administrador padrão
INSERT INTO users (email, password_hash, user_type, name, code) VALUES 
('admin@porteiro.app', '$2b$10$example_hash', 'admin', 'Administrador', 'ADMIN001');

-- Inserir porteiro padrão
INSERT INTO users (email, password_hash, user_type, name, code) VALUES 
('porteiro@porteiro.app', '$2b$10$example_hash', 'porteiro', 'Porteiro Principal', 'PORT001');