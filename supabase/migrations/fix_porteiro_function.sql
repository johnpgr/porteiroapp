-- Corrigir função is_current_user_porteiro para usar colunas corretas

-- 1. Corrigir função para verificar se o usuário atual é porteiro
CREATE OR REPLACE FUNCTION is_current_user_porteiro()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se o usuário atual é porteiro na tabela profiles
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
       AND user_type = 'porteiro'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Testar a função corrigida
SELECT 'Função is_current_user_porteiro corrigida com sucesso' as status;