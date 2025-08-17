-- Migration: 004_insert_test_users_only.sql
-- Description: Insert only test users (skip existing data)
-- Created: Fix for missing test users

-- Insert test users with hashed passwords (SHA-256) - using ON CONFLICT DO NOTHING
-- Password: admin123 -> SHA-256: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
-- Password: porteiro123 -> SHA-256: 8bb0cf6eb9b17d0f7d22b456f121257dc1254e1f01665370476383ea776df414
-- Password: morador123 -> SHA-256: 3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1

INSERT INTO users (id, email, password_hash, user_type, name, phone, condominium_id, building_id, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440010', 'admin@teste.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin', 'Administrador Teste', '(11) 9999-1111', '550e8400-e29b-41d4-a716-446655440001', NULL, NOW()),
('550e8400-e29b-41d4-a716-446655440011', 'porteiro@teste.com', '8bb0cf6eb9b17d0f7d22b456f121257dc1254e1f01665370476383ea776df414', 'porteiro', 'Porteiro Teste', '(11) 9999-2222', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW()),
('550e8400-e29b-41d4-a716-446655440012', 'morador@teste.com', '3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1', 'morador', 'Morador Teste', '(11) 9999-3333', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test residents - using ON CONFLICT DO NOTHING
INSERT INTO residents (id, apartment_id, user_id, is_owner, condominium_id, building_id, created_at) VALUES 
('550e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440012', true, '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', NOW())
ON CONFLICT (id) DO NOTHING;

-- Comment: Test accounts for development
-- Admin: admin@teste.com / admin123
-- Porteiro: porteiro@teste.com / porteiro123
-- Morador: morador@teste.com / morador123