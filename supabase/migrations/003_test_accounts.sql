-- Migration: 003_test_accounts.sql
-- Description: Insert test accounts for development with complete hierarchical structure
-- Created: Development test data

-- Insert test condominium
INSERT INTO condominiums (id, name, address, phone, email, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'Condomínio Teste', 'Rua das Flores, 123 - Centro', '(11) 1234-5678', 'admin@condominioteste.com', NOW());

-- Insert test building
INSERT INTO buildings (id, condominium_id, name, address, floors, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Bloco A', 'Rua das Flores, 123 - Bloco A', 10, NOW());

-- Insert test apartments
INSERT INTO apartments (id, building_id, number, floor, condominium_id, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '101', 1, '550e8400-e29b-41d4-a716-446655440001', NOW()),
('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', '201', 2, '550e8400-e29b-41d4-a716-446655440001', NOW()),
('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', '301', 3, '550e8400-e29b-41d4-a716-446655440001', NOW());

-- Insert test users with hashed passwords (SHA-256)
-- Password: admin123 -> SHA-256: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
-- Password: porteiro123 -> SHA-256: 8bb0cf6eb9b17d0f7d22b456f121257dc1254e1f01665370476383ea776df414
-- Password: morador123 -> SHA-256: 3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1

INSERT INTO users (id, email, password_hash, user_type, name, phone, condominium_id, building_id, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440010', 'admin@teste.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin', 'Administrador Teste', '(11) 9999-1111', '550e8400-e29b-41d4-a716-446655440001', NULL, NOW()),
('550e8400-e29b-41d4-a716-446655440011', 'porteiro@teste.com', '8bb0cf6eb9b17d0f7d22b456f121257dc1254e1f01665370476383ea776df414', 'porteiro', 'Porteiro Teste', '(11) 9999-2222', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW()),
('550e8400-e29b-41d4-a716-446655440012', 'morador@teste.com', '3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1', 'morador', 'Morador Teste', '(11) 9999-3333', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW());

-- Insert test residents
INSERT INTO residents (id, apartment_id, user_id, is_owner, condominium_id, building_id, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440012', true, '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW());

-- Insert additional test residents (family members)
INSERT INTO users (id, email, password_hash, user_type, name, phone, condominium_id, building_id, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440013', 'maria@teste.com', '3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1', 'morador', 'Maria Silva Teste', '(11) 9999-4444', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW()),
('550e8400-e29b-41d4-a716-446655440014', 'joao@teste.com', '3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1', 'morador', 'João Santos Teste', '(11) 9999-5555', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW());

INSERT INTO residents (id, apartment_id, user_id, is_owner, condominium_id, building_id, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440013', true, '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW()),
('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440014', true, '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW());

-- Insert test visitors
INSERT INTO visitors (id, visitor_name, visitor_document, visitor_phone, visitor_photo_url, apartment_id, building_id, condominium_id, visit_type, status, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440030', 'João Silva Visitante', '123.456.789-00', '(11) 9999-1111', 'https://example.com/photo1.jpg', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'visitor', 'pending', NOW()),
('550e8400-e29b-41d4-a716-446655440031', 'Maria Santos Visitante', '987.654.321-00', '(11) 9999-2222', 'https://example.com/photo2.jpg', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'visitor', 'authorized', NOW());

-- Insert test visitor logs
INSERT INTO visitor_logs (id, visitor_id, action, performed_by, timestamp, condominium_id, building_id) VALUES 
('550e8400-e29b-41d4-a716-446655440040', '550e8400-e29b-41d4-a716-446655440030', 'authorized', '550e8400-e29b-41d4-a716-446655440011', NOW() - INTERVAL '2 hours', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440031', 'entry', '550e8400-e29b-41d4-a716-446655440011', NOW() - INTERVAL '1 hour', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002');

-- Insert test deliveries
INSERT INTO deliveries (id, apartment_id, sender_name, tracking_code, delivery_date, received_by, status, delivery_photo_url, delivery_location, condominium_id, building_id, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440050', '550e8400-e29b-41d4-a716-446655440003', 'Correios', 'BR123456789', CURRENT_DATE, '550e8400-e29b-41d4-a716-446655440011', 'delivered', 'https://example.com/delivery1.jpg', 'Portaria', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW()),
('550e8400-e29b-41d4-a716-446655440051', '550e8400-e29b-41d4-a716-446655440004', 'Amazon', 'AMZ987654321', CURRENT_DATE, '550e8400-e29b-41d4-a716-446655440011', 'received', 'https://example.com/delivery2.jpg', 'Portaria', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW());

-- Insert test communications
INSERT INTO communications (id, sender_id, apartment_id, message_type, title, content, is_general, condominium_id, building_id, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440060', '550e8400-e29b-41d4-a716-446655440010', NULL, 'aviso', 'Aviso Importante', 'Manutenção do elevador programada para amanhã das 8h às 12h', true, '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW()),
('550e8400-e29b-41d4-a716-446655440061', '550e8400-e29b-41d4-a716-446655440010', NULL, 'comunicado', 'Reunião de Condomínio', 'Reunião mensal agendada para próxima sexta-feira às 19h no salão de festas', true, '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW());

-- Grant permissions for test accounts
GRANT SELECT, INSERT, UPDATE, DELETE ON condominiums TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON buildings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON apartments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON residents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON visitors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON visitor_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON communications TO authenticated;

-- Comment: Test accounts created for development
-- Admin: admin@teste.com / admin123
-- Porteiro: porteiro@teste.com / porteiro123
-- Morador: morador@teste.com / morador123
-- Additional residents: maria@teste.com, joao@teste.com / morador123