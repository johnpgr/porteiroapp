-- Corrigir a função RPC get_apartment_residents - Versão 2
-- Resolver erro "structure of query does not match function result type"
-- Implementar função completa que retorna todos os moradores do apartamento

-- Primeiro, vamos dropar a função existente se ela existir
DROP FUNCTION IF EXISTS get_apartment_residents(TEXT, UUID);

-- Criar a função corrigida com tipos de dados corretos
CREATE OR REPLACE FUNCTION get_apartment_residents(
  apartment_number TEXT,
  building_id UUID
)
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  user_type TEXT,
  is_available BOOLEAN,
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE,
  apt_number TEXT,
  building_name TEXT,
  apartment_id UUID,
  is_primary BOOLEAN,
  is_owner BOOLEAN,
  relationship TEXT,
  device_tokens JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id::UUID as profile_id,
    p.full_name::TEXT,
    p.email::TEXT,
    p.phone::TEXT,
    p.user_type::TEXT,
    COALESCE(p.is_available, true)::BOOLEAN as is_available,
    COALESCE(p.is_online, false)::BOOLEAN as is_online,
    p.last_seen::TIMESTAMP WITH TIME ZONE,
    a.number::TEXT as apt_number,
    b.name::TEXT as building_name,
    a.id::UUID as apartment_id,
    COALESCE(ar.is_primary, false)::BOOLEAN as is_primary,
    COALESCE(ar.is_owner, false)::BOOLEAN as is_owner,
    COALESCE(ar.relationship, 'morador')::TEXT as relationship,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'token', wdt.token,
            'platform', wdt.platform,
            'is_active', wdt.is_active,
            'created_at', wdt.created_at
          )
        )
        FROM device_tokens wdt 
        WHERE wdt.profile_id = p.id AND wdt.is_active = true
      ), 
      '[]'::jsonb
    )::JSONB as device_tokens
  FROM profiles p
  INNER JOIN apartment_residents ar ON p.id = ar.profile_id
  INNER JOIN apartments a ON ar.apartment_id = a.id
  INNER JOIN buildings b ON a.building_id = b.id
  WHERE a.number = get_apartment_residents.apartment_number
    AND b.id = get_apartment_residents.building_id
    AND p.user_type = 'morador'
    AND ar.is_active = true
  ORDER BY ar.is_primary DESC, ar.is_owner DESC, p.full_name;
END;
$$;

-- Criar função alternativa que aceita apartment_number como INTEGER
CREATE OR REPLACE FUNCTION get_apartment_residents(
  apartment_number INTEGER,
  building_id UUID
)
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  user_type TEXT,
  is_available BOOLEAN,
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE,
  apt_number TEXT,
  building_name TEXT,
  apartment_id UUID,
  is_primary BOOLEAN,
  is_owner BOOLEAN,
  relationship TEXT,
  device_tokens JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Converter INTEGER para TEXT e chamar a função principal
  RETURN QUERY
  SELECT * FROM get_apartment_residents(apartment_number::TEXT, building_id);
END;
$$;

-- Adicionar comentários explicativos
COMMENT ON FUNCTION get_apartment_residents(TEXT, UUID) IS 'Função principal para buscar moradores de um apartamento específico - aceita apartment_number como TEXT';
COMMENT ON FUNCTION get_apartment_residents(INTEGER, UUID) IS 'Função sobregregada para buscar moradores de um apartamento específico - aceita apartment_number como INTEGER';

-- Criar função de teste para validar a estrutura
CREATE OR REPLACE FUNCTION test_get_apartment_residents()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  test_result TEXT;
  record_count INTEGER;
BEGIN
  -- Testar se a função existe e retorna dados válidos
  BEGIN
    SELECT COUNT(*) INTO record_count
    FROM get_apartment_residents('101', '03406637-506c-4bfe-938d-9de46806aa19'::UUID);
    
    test_result := 'SUCCESS: Função executada com sucesso. Registros encontrados: ' || record_count;
  EXCEPTION
    WHEN OTHERS THEN
      test_result := 'ERROR: ' || SQLERRM;
  END;
  
  RETURN test_result;
END;
$$;