-- Create missing auth users for porteiro and morador accounts
-- These accounts need to exist in auth.users for Supabase Auth to work

-- First, let's get the building and apartment IDs we need
DO $$
DECLARE
    condominium_uuid uuid;
    building_uuid uuid;
    apartment_101_uuid uuid;
    apartment_102_uuid uuid;
BEGIN
    -- Get the test condominium ID
    SELECT id INTO condominium_uuid FROM condominiums WHERE name = 'Residencial Teste' LIMIT 1;
    
    -- Get the test building ID
    SELECT id INTO building_uuid FROM buildings WHERE name = 'Bloco A' AND condominium_id = condominium_uuid LIMIT 1;
    
    -- Get apartment IDs
    SELECT id INTO apartment_101_uuid FROM apartments WHERE number = '101' AND building_id = building_uuid LIMIT 1;
    SELECT id INTO apartment_102_uuid FROM apartments WHERE number = '102' AND building_id = building_uuid LIMIT 1;
    
    -- Create porteiro@teste.com in auth.users if not exists
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440011',
        '00000000-0000-0000-0000-000000000000',
        'porteiro@teste.com',
        crypt('porteiro123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"user_type": "porteiro"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create morador@teste.com in auth.users if not exists
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440012',
        '00000000-0000-0000-0000-000000000000',
        'morador@teste.com',
        crypt('morador123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"user_type": "morador"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create porteiro1@teste.com in auth.users if not exists
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440013',
        '00000000-0000-0000-0000-000000000000',
        'porteiro1@teste.com',
        crypt('porteiro123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"user_type": "porteiro"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create porteiro2@teste.com in auth.users if not exists
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440014',
        '00000000-0000-0000-0000-000000000000',
        'porteiro2@teste.com',
        crypt('porteiro123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"user_type": "porteiro"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create morador1@teste.com in auth.users if not exists
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440015',
        '00000000-0000-0000-0000-000000000000',
        'morador1@teste.com',
        crypt('morador123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"user_type": "morador"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Create morador2@teste.com in auth.users if not exists
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440016',
        '00000000-0000-0000-0000-000000000000',
        'morador2@teste.com',
        crypt('morador123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"user_type": "morador"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Now create/update profiles for these users
    
    -- porteiro@teste.com profile
    INSERT INTO profiles (
        id,
        email,
        user_type,
        condominium_id,
        building_id,
        apartment_id,
        is_active
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440011',
        'porteiro@teste.com',
        'porteiro',
        condominium_uuid,
        building_uuid,
        NULL,
        true
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        user_type = EXCLUDED.user_type,
        condominium_id = EXCLUDED.condominium_id,
        building_id = EXCLUDED.building_id,
        apartment_id = EXCLUDED.apartment_id,
        is_active = EXCLUDED.is_active;
    
    -- morador@teste.com profile
    INSERT INTO profiles (
        id,
        email,
        user_type,
        condominium_id,
        building_id,
        apartment_id,
        is_active
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440012',
        'morador@teste.com',
        'morador',
        condominium_uuid,
        building_uuid,
        apartment_101_uuid,
        true
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        user_type = EXCLUDED.user_type,
        condominium_id = EXCLUDED.condominium_id,
        building_id = EXCLUDED.building_id,
        apartment_id = EXCLUDED.apartment_id,
        is_active = EXCLUDED.is_active;
    
    -- porteiro1@teste.com profile
    INSERT INTO profiles (
        id,
        email,
        user_type,
        condominium_id,
        building_id,
        apartment_id,
        is_active
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440013',
        'porteiro1@teste.com',
        'porteiro',
        condominium_uuid,
        building_uuid,
        NULL,
        true
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        user_type = EXCLUDED.user_type,
        condominium_id = EXCLUDED.condominium_id,
        building_id = EXCLUDED.building_id,
        apartment_id = EXCLUDED.apartment_id,
        is_active = EXCLUDED.is_active;
    
    -- porteiro2@teste.com profile
    INSERT INTO profiles (
        id,
        email,
        user_type,
        condominium_id,
        building_id,
        apartment_id,
        is_active
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440014',
        'porteiro2@teste.com',
        'porteiro',
        condominium_uuid,
        building_uuid,
        NULL,
        true
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        user_type = EXCLUDED.user_type,
        condominium_id = EXCLUDED.condominium_id,
        building_id = EXCLUDED.building_id,
        apartment_id = EXCLUDED.apartment_id,
        is_active = EXCLUDED.is_active;
    
    -- morador1@teste.com profile
    INSERT INTO profiles (
        id,
        email,
        user_type,
        condominium_id,
        building_id,
        apartment_id,
        is_active
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440015',
        'morador1@teste.com',
        'morador',
        condominium_uuid,
        building_uuid,
        apartment_101_uuid,
        true
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        user_type = EXCLUDED.user_type,
        condominium_id = EXCLUDED.condominium_id,
        building_id = EXCLUDED.building_id,
        apartment_id = EXCLUDED.apartment_id,
        is_active = EXCLUDED.is_active;
    
    -- morador2@teste.com profile
    INSERT INTO profiles (
        id,
        email,
        user_type,
        condominium_id,
        building_id,
        apartment_id,
        is_active
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440016',
        'morador2@teste.com',
        'morador',
        condominium_uuid,
        building_uuid,
        apartment_102_uuid,
        true
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        user_type = EXCLUDED.user_type,
        condominium_id = EXCLUDED.condominium_id,
        building_id = EXCLUDED.building_id,
        apartment_id = EXCLUDED.apartment_id,
        is_active = EXCLUDED.is_active;
        
END $$;