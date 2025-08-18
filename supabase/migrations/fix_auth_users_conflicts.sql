-- Fix auth users conflicts by checking existing users and updating profiles accordingly
-- First, let's see what users actually exist in auth.users

DO $$
DECLARE
    condominium_uuid uuid;
    building_uuid uuid;
    apartment_101_uuid uuid;
    apartment_102_uuid uuid;
    porteiro_auth_id uuid;
    morador_auth_id uuid;
    porteiro1_auth_id uuid;
    porteiro2_auth_id uuid;
    morador1_auth_id uuid;
    morador2_auth_id uuid;
BEGIN
    -- Get the test condominium ID
    SELECT id INTO condominium_uuid FROM condominiums WHERE name = 'Residencial Teste' LIMIT 1;
    
    -- Get the test building ID
    SELECT id INTO building_uuid FROM buildings WHERE name = 'Bloco A' AND condominium_id = condominium_uuid LIMIT 1;
    
    -- Get apartment IDs
    SELECT id INTO apartment_101_uuid FROM apartments WHERE number = '101' AND building_id = building_uuid LIMIT 1;
    SELECT id INTO apartment_102_uuid FROM apartments WHERE number = '102' AND building_id = building_uuid LIMIT 1;
    
    -- Get existing auth user IDs
    SELECT id INTO porteiro_auth_id FROM auth.users WHERE email = 'porteiro@teste.com' LIMIT 1;
    SELECT id INTO morador_auth_id FROM auth.users WHERE email = 'morador@teste.com' LIMIT 1;
    SELECT id INTO porteiro1_auth_id FROM auth.users WHERE email = 'porteiro1@teste.com' LIMIT 1;
    SELECT id INTO porteiro2_auth_id FROM auth.users WHERE email = 'porteiro2@teste.com' LIMIT 1;
    SELECT id INTO morador1_auth_id FROM auth.users WHERE email = 'morador1@teste.com' LIMIT 1;
    SELECT id INTO morador2_auth_id FROM auth.users WHERE email = 'morador2@teste.com' LIMIT 1;
    
    -- Create porteiro@teste.com in auth.users if not exists
    IF porteiro_auth_id IS NULL THEN
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
            gen_random_uuid(),
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
        ) RETURNING id INTO porteiro_auth_id;
    END IF;
    
    -- Create morador@teste.com in auth.users if not exists
    IF morador_auth_id IS NULL THEN
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
            gen_random_uuid(),
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
        ) RETURNING id INTO morador_auth_id;
    END IF;
    
    -- Update or create profiles using the correct auth user IDs
    
    -- porteiro@teste.com profile
    IF porteiro_auth_id IS NOT NULL THEN
        INSERT INTO profiles (
            id,
            email,
            user_type,
            condominium_id,
            building_id,
            apartment_id,
            is_active
        ) VALUES (
            porteiro_auth_id,
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
    END IF;
    
    -- morador@teste.com profile
    IF morador_auth_id IS NOT NULL THEN
        INSERT INTO profiles (
            id,
            email,
            user_type,
            condominium_id,
            building_id,
            apartment_id,
            is_active
        ) VALUES (
            morador_auth_id,
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
    END IF;
    
    -- Update profiles for existing porteiro1, porteiro2, morador1, morador2 if they exist in auth.users
    IF porteiro1_auth_id IS NOT NULL THEN
        INSERT INTO profiles (
            id,
            email,
            user_type,
            condominium_id,
            building_id,
            apartment_id,
            is_active
        ) VALUES (
            porteiro1_auth_id,
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
    END IF;
    
    IF porteiro2_auth_id IS NOT NULL THEN
        INSERT INTO profiles (
            id,
            email,
            user_type,
            condominium_id,
            building_id,
            apartment_id,
            is_active
        ) VALUES (
            porteiro2_auth_id,
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
    END IF;
    
    IF morador1_auth_id IS NOT NULL THEN
        INSERT INTO profiles (
            id,
            email,
            user_type,
            condominium_id,
            building_id,
            apartment_id,
            is_active
        ) VALUES (
            morador1_auth_id,
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
    END IF;
    
    IF morador2_auth_id IS NOT NULL THEN
        INSERT INTO profiles (
            id,
            email,
            user_type,
            condominium_id,
            building_id,
            apartment_id,
            is_active
        ) VALUES (
            morador2_auth_id,
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
    END IF;
    
    -- Output summary
    RAISE NOTICE 'Auth users fixed:';
    RAISE NOTICE 'porteiro@teste.com: %', COALESCE(porteiro_auth_id::text, 'NOT FOUND');
    RAISE NOTICE 'morador@teste.com: %', COALESCE(morador_auth_id::text, 'NOT FOUND');
    RAISE NOTICE 'porteiro1@teste.com: %', COALESCE(porteiro1_auth_id::text, 'NOT FOUND');
    RAISE NOTICE 'porteiro2@teste.com: %', COALESCE(porteiro2_auth_id::text, 'NOT FOUND');
    RAISE NOTICE 'morador1@teste.com: %', COALESCE(morador1_auth_id::text, 'NOT FOUND');
    RAISE NOTICE 'morador2@teste.com: %', COALESCE(morador2_auth_id::text, 'NOT FOUND');
        
END $$;