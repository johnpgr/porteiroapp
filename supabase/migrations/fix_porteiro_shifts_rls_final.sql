-- Corrigir políticas RLS e adicionar constraint para prevenir múltiplos turnos ativos

-- 1. Remover políticas RLS existentes
DROP POLICY IF EXISTS "Porteiros podem gerenciar seus próprios turnos" ON porteiro_shifts;
DROP POLICY IF EXISTS "Administradores podem gerenciar turnos" ON porteiro_shifts;
DROP POLICY IF EXISTS "Super administradores podem gerenciar todos os turnos" ON porteiro_shifts;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir turnos" ON porteiro_shifts;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar turnos" ON porteiro_shifts;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar turnos" ON porteiro_shifts;
DROP POLICY IF EXISTS "Usuários anônimos podem visualizar turnos" ON porteiro_shifts;

-- 2. Criar nova política mais simples e funcional
-- Permitir que usuários autenticados façam operações se:
-- a) São o próprio porteiro (auth.uid() = profiles.user_id onde profiles.id = porteiro_id)
-- b) São admin do mesmo prédio
-- c) São super admin

-- Política para SELECT
CREATE POLICY "Visualizar turnos" ON porteiro_shifts
  FOR SELECT
  USING (
    -- Usuário é o próprio porteiro
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = porteiro_shifts.porteiro_id 
      AND profiles.user_id = auth.uid()
    )
    OR
    -- Usuário é admin do mesmo prédio
    EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.user_id = auth.uid()
      AND p1.role IN ('admin', 'super_admin')
      AND p2.id = porteiro_shifts.porteiro_id
      AND (p1.building_id = p2.building_id OR p1.role = 'super_admin')
    )
  );

-- Política para INSERT
CREATE POLICY "Inserir turnos" ON porteiro_shifts
  FOR INSERT
  WITH CHECK (
    -- Usuário é o próprio porteiro
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = porteiro_shifts.porteiro_id 
      AND profiles.user_id = auth.uid()
    )
    OR
    -- Usuário é admin do mesmo prédio
    EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.user_id = auth.uid()
      AND p1.role IN ('admin', 'super_admin')
      AND p2.id = porteiro_shifts.porteiro_id
      AND (p1.building_id = p2.building_id OR p1.role = 'super_admin')
    )
  );

-- Política para UPDATE
CREATE POLICY "Atualizar turnos" ON porteiro_shifts
  FOR UPDATE
  USING (
    -- Usuário é o próprio porteiro
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = porteiro_shifts.porteiro_id 
      AND profiles.user_id = auth.uid()
    )
    OR
    -- Usuário é admin do mesmo prédio
    EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.user_id = auth.uid()
      AND p1.role IN ('admin', 'super_admin')
      AND p2.id = porteiro_shifts.porteiro_id
      AND (p1.building_id = p2.building_id OR p1.role = 'super_admin')
    )
  );

-- Política para DELETE
CREATE POLICY "Deletar turnos" ON porteiro_shifts
  FOR DELETE
  USING (
    -- Usuário é admin do mesmo prédio ou super admin
    EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.user_id = auth.uid()
      AND p1.role IN ('admin', 'super_admin')
      AND p2.id = porteiro_shifts.porteiro_id
      AND (p1.building_id = p2.building_id OR p1.role = 'super_admin')
    )
  );

-- 3. Adicionar constraint para prevenir múltiplos turnos ativos
-- Primeiro, vamos fechar todos os turnos duplicados (manter apenas o mais recente)
WITH duplicated_shifts AS (
  SELECT 
    id,
    porteiro_id,
    shift_start,
    ROW_NUMBER() OVER (PARTITION BY porteiro_id ORDER BY shift_start DESC) as rn
  FROM porteiro_shifts 
  WHERE shift_end IS NULL
)
UPDATE porteiro_shifts 
SET shift_end = NOW()
WHERE id IN (
  SELECT id FROM duplicated_shifts WHERE rn > 1
);

-- Agora adicionar constraint única para prevenir futuros turnos duplicados
-- Usar índice parcial para permitir apenas um turno ativo por porteiro
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_shift 
ON porteiro_shifts (porteiro_id) 
WHERE shift_end IS NULL;

-- 4. Verificar permissões
SELECT 
  grantee, 
  table_name, 
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'porteiro_shifts'
AND grantee IN ('anon', 'authenticated') 
ORDER BY grantee, privilege_type;

-- 5. Verificar políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'porteiro_shifts';