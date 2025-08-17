-- Migration para sincronizar profiles com usuários existentes no auth.users
-- Esta migration cria profiles para usuários que já existem no sistema

-- Primeiro, garantir que temos a estrutura básica de teste
-- Inserir condomínio de teste se não existir
INSERT INTO public.condominiums (id, name, address, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Residencial Teste',
  'Rua de Teste, 123',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Inserir prédio de teste se não existir
INSERT INTO public.buildings (id, condominium_id, name, address, created_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Bloco A',
  'Bloco A - Residencial Teste',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Inserir apartamento de teste se não existir
INSERT INTO public.apartments (id, building_id, number, floor, created_at)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '101',
  1,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Criar profiles para usuários existentes no auth.users
-- Usar uma função para fazer isso de forma segura

DO $$
DECLARE
    admin_user_id uuid;
    porteiro_user_id uuid;
    morador_user_id uuid;
BEGIN
    -- Buscar IDs dos usuários existentes
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@teste.com' LIMIT 1;
    SELECT id INTO porteiro_user_id FROM auth.users WHERE email = 'porteiro@teste.com' LIMIT 1;
    SELECT id INTO morador_user_id FROM auth.users WHERE email = 'morador@teste.com' LIMIT 1;
    
    -- Inserir profile do admin se o usuário existir
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (
            id,
            email,
            user_type,
            condominium_id,
            building_id,
            apartment_id,
            is_active
        ) VALUES (
            admin_user_id,
            'admin@teste.com',
            'admin',
            '11111111-1111-1111-1111-111111111111',
            NULL,
            NULL,
            true
        ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            user_type = EXCLUDED.user_type,
            condominium_id = EXCLUDED.condominium_id,
            is_active = EXCLUDED.is_active;
    END IF;
    
    -- Inserir profile do porteiro se o usuário existir
    IF porteiro_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (
            id,
            email,
            user_type,
            condominium_id,
            building_id,
            apartment_id,
            is_active
        ) VALUES (
            porteiro_user_id,
            'porteiro@teste.com',
            'porteiro',
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
            NULL,
            true
        ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            user_type = EXCLUDED.user_type,
            condominium_id = EXCLUDED.condominium_id,
            building_id = EXCLUDED.building_id,
            is_active = EXCLUDED.is_active;
    END IF;
    
    -- Inserir profile do morador se o usuário existir
    IF morador_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (
            id,
            email,
            user_type,
            condominium_id,
            building_id,
            apartment_id,
            is_active
        ) VALUES (
            morador_user_id,
            'morador@teste.com',
            'morador',
            '11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222',
            '33333333-3333-3333-3333-333333333333',
            true
        ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            user_type = EXCLUDED.user_type,
            condominium_id = EXCLUDED.condominium_id,
            building_id = EXCLUDED.building_id,
            apartment_id = EXCLUDED.apartment_id,
            is_active = EXCLUDED.is_active;
    END IF;
END $$;