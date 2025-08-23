-- Inserir registros de teste na tabela visitor_logs para admin@dev.com
-- Incluindo prédios/apartamentos que ele gerencia e não gerencia

-- Primeiro, vamos inserir alguns visitantes de teste se não existirem
INSERT INTO visitors (id, name, document, phone, is_active, created_at) 
VALUES 
    ('550e8400-e29b-41d4-a716-446655440001', 'João Silva Santos', '12345678901', '11987654321', true, NOW() - INTERVAL '30 days'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Maria Oliveira Costa', '98765432109', '11876543210', true, NOW() - INTERVAL '25 days'),
    ('550e8400-e29b-41d4-a716-446655440003', 'Carlos Eduardo Lima', '45678912345', '11765432109', true, NOW() - INTERVAL '20 days'),
    ('550e8400-e29b-41d4-a716-446655440004', 'Ana Paula Ferreira', '78912345678', '11654321098', true, NOW() - INTERVAL '15 days'),
    ('550e8400-e29b-41d4-a716-446655440005', 'Roberto Almeida', '32165498712', '11543210987', true, NOW() - INTERVAL '10 days'),
    ('550e8400-e29b-41d4-a716-446655440006', 'Fernanda Souza', '65498732165', '11432109876', true, NOW() - INTERVAL '5 days'),
    ('550e8400-e29b-41d4-a716-446655440007', 'Pedro Henrique', '14725836947', '11321098765', true, NOW() - INTERVAL '3 days'),
    ('550e8400-e29b-41d4-a716-446655440008', 'Juliana Martins', '85296374185', '11210987654', true, NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- Inserir logs para prédios/apartamentos gerenciados pelo admin@dev.com
-- (Assumindo que o admin gerencia alguns prédios específicos)
INSERT INTO visitor_logs (
    id,
    visitor_id,
    building_id,
    apartment_id,
    purpose,
    status,
    entry_time,
    exit_time,
    authorized_by,
    created_at
) VALUES 
    -- Logs para prédios gerenciados (estes devem aparecer nos logs do admin)
    (
        gen_random_uuid(),
        '550e8400-e29b-41d4-a716-446655440001',
        (SELECT building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1),
        (SELECT a.id FROM apartments a JOIN building_admins ba ON a.building_id = ba.building_id JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1),
        'Visita social',
        'completed',
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '1 hour',
        (SELECT id FROM profiles WHERE email = 'admin@dev.com'),
        NOW() - INTERVAL '2 hours'
    ),
    (
        gen_random_uuid(),
        '550e8400-e29b-41d4-a716-446655440002',
        (SELECT building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1),
        (SELECT a.id FROM apartments a JOIN building_admins ba ON a.building_id = ba.building_id JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1 OFFSET 1),
        'Entrega de encomenda',
        'approved',
        NOW() - INTERVAL '4 hours',
        NULL,
        NULL,
        NOW() - INTERVAL '4 hours'
    ),
    (
        gen_random_uuid(),
        '550e8400-e29b-41d4-a716-446655440003',
        (SELECT building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1),
        (SELECT a.id FROM apartments a JOIN building_admins ba ON a.building_id = ba.building_id JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1),
        'Manutenção',
        'pending',
        NOW() - INTERVAL '1 day',
        NULL,
        NULL,
        NOW() - INTERVAL '1 day'
    ),
    (
        gen_random_uuid(),
        '550e8400-e29b-41d4-a716-446655440004',
        (SELECT building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1),
        (SELECT a.id FROM apartments a JOIN building_admins ba ON a.building_id = ba.building_id JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1),
        'Visita familiar',
        'rejected',
        NOW() - INTERVAL '3 days',
        NULL,
        (SELECT id FROM profiles WHERE email = 'admin@dev.com'),
        NOW() - INTERVAL '3 days'
    );

-- Inserir logs para prédios NÃO gerenciados pelo admin@dev.com
-- (Estes NÃO devem aparecer nos logs do admin devido ao filtro RLS)
INSERT INTO visitor_logs (
    id,
    visitor_id,
    building_id,
    apartment_id,
    purpose,
    status,
    entry_time,
    exit_time,
    authorized_by,
    created_at
) VALUES 
    (
        gen_random_uuid(),
        '550e8400-e29b-41d4-a716-446655440005',
        (SELECT b.id FROM buildings b WHERE b.id NOT IN (SELECT ba.building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com') LIMIT 1),
        (SELECT a.id FROM apartments a JOIN buildings b ON a.building_id = b.id WHERE b.id NOT IN (SELECT ba.building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com') LIMIT 1),
        'Visita comercial',
        'completed',
        NOW() - INTERVAL '5 hours',
        NOW() - INTERVAL '4 hours',
        NULL,
        NOW() - INTERVAL '5 hours'
    ),
    (
        gen_random_uuid(),
        '550e8400-e29b-41d4-a716-446655440006',
        (SELECT b.id FROM buildings b WHERE b.id NOT IN (SELECT ba.building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com') LIMIT 1),
        (SELECT a.id FROM apartments a JOIN buildings b ON a.building_id = b.id WHERE b.id NOT IN (SELECT ba.building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com') LIMIT 1),
        'Entrega de comida',
        'approved',
        NOW() - INTERVAL '6 hours',
        NULL,
        NULL,
        NOW() - INTERVAL '6 hours'
    ),
    (
        gen_random_uuid(),
        '550e8400-e29b-41d4-a716-446655440007',
        (SELECT b.id FROM buildings b WHERE b.id NOT IN (SELECT ba.building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com') LIMIT 1),
        (SELECT a.id FROM apartments a JOIN buildings b ON a.building_id = b.id WHERE b.id NOT IN (SELECT ba.building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com') LIMIT 1),
        'Serviços gerais',
        'pending',
        NOW() - INTERVAL '2 days',
        NULL,
        NULL,
        NOW() - INTERVAL '2 days'
    );

-- Inserir mais alguns logs variados para prédios gerenciados
INSERT INTO visitor_logs (
    id,
    visitor_id,
    building_id,
    apartment_id,
    purpose,
    status,
    entry_time,
    exit_time,
    authorized_by,
    created_at
) VALUES 
    (
        gen_random_uuid(),
        '550e8400-e29b-41d4-a716-446655440008',
        (SELECT building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1),
        (SELECT a.id FROM apartments a JOIN building_admins ba ON a.building_id = ba.building_id JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1 OFFSET 2),
        'Prestação de serviços',
        'completed',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '23 hours',
        (SELECT id FROM profiles WHERE email = 'admin@dev.com'),
        NOW() - INTERVAL '1 day'
    ),
    (
        gen_random_uuid(),
        '550e8400-e29b-41d4-a716-446655440001',
        (SELECT building_id FROM building_admins ba JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1),
        (SELECT a.id FROM apartments a JOIN building_admins ba ON a.building_id = ba.building_id JOIN admin_profiles ap ON ba.admin_profile_id = ap.id WHERE ap.email = 'admin@dev.com' LIMIT 1 OFFSET 1),
        'Visita médica',
        'approved',
        NOW() + INTERVAL '2 hours',
        NULL,
        NULL,
        NOW()
    );