-- Migration: Create porteiro_shifts system for doorman shift management
-- Date: 2025-01-30
-- Purpose: Implement shift control system for doormen with notifications filtering

-- =====================================================
-- 1. CREATE PORTEIRO_SHIFTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS porteiro_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  porteiro_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  shift_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  shift_end TIMESTAMP WITH TIME ZONE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'interrupted')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for queries by porteiro_id
CREATE INDEX IF NOT EXISTS idx_porteiro_shifts_porteiro_id ON porteiro_shifts(porteiro_id);

-- Index for queries by building_id
CREATE INDEX IF NOT EXISTS idx_porteiro_shifts_building_id ON porteiro_shifts(building_id);

-- Index for queries by status
CREATE INDEX IF NOT EXISTS idx_porteiro_shifts_status ON porteiro_shifts(status);

-- Composite index for active shifts by building (most important query)
CREATE INDEX IF NOT EXISTS idx_porteiro_shifts_active ON porteiro_shifts(building_id, status) WHERE status = 'active';

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_porteiro_shifts_time ON porteiro_shifts(shift_start, shift_end);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE porteiro_shifts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is porteiro
CREATE OR REPLACE FUNCTION is_current_user_porteiro()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'porteiro'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'admin'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin or porteiro
CREATE OR REPLACE FUNCTION is_current_user_admin_or_porteiro()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type IN ('admin', 'porteiro')
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active porteiro for a building
CREATE OR REPLACE FUNCTION get_active_porteiro(building_uuid UUID)
RETURNS UUID AS $$
DECLARE
  active_porteiro_id UUID;
BEGIN
  SELECT porteiro_id INTO active_porteiro_id
  FROM porteiro_shifts
  WHERE building_id = building_uuid
    AND status = 'active'
    AND shift_start <= NOW()
  ORDER BY shift_start DESC
  LIMIT 1;
  
  RETURN active_porteiro_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate shift overlap
CREATE OR REPLACE FUNCTION validate_shift_overlap(
  building_uuid UUID,
  porteiro_uuid UUID,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if there are active shifts in the same building by different porteiros
  RETURN NOT EXISTS (
    SELECT 1
    FROM porteiro_shifts
    WHERE building_id = building_uuid
      AND status = 'active'
      AND porteiro_id != porteiro_uuid
      AND shift_start <= start_time
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-close old shifts (for maintenance)
CREATE OR REPLACE FUNCTION auto_close_old_shifts()
RETURNS INTEGER AS $$
DECLARE
  closed_count INTEGER;
BEGIN
  UPDATE porteiro_shifts
  SET status = 'interrupted',
      shift_end = NOW(),
      notes = COALESCE(notes || ' | ', '') || 'Turno finalizado automaticamente após 24h',
      updated_at = NOW()
  WHERE status = 'active'
    AND shift_start < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. CREATE RLS POLICIES
-- =====================================================

-- Policy for SELECT: Porteiros can see their own shifts, admins can see all
CREATE POLICY "porteiro_shifts_select_policy" ON porteiro_shifts
  FOR SELECT TO authenticated
  USING (
    porteiro_id = auth.uid() OR 
    is_current_user_admin() OR
    (
      is_current_user_porteiro() AND 
      building_id IN (
        SELECT building_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Policy for INSERT: Only porteiros can create their own shifts
CREATE POLICY "porteiro_shifts_insert_policy" ON porteiro_shifts
  FOR INSERT TO authenticated
  WITH CHECK (
    porteiro_id = auth.uid() AND 
    is_current_user_porteiro() AND
    building_id IN (
      SELECT building_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy for UPDATE: Porteiros can update their own shifts, admins can update any
CREATE POLICY "porteiro_shifts_update_policy" ON porteiro_shifts
  FOR UPDATE TO authenticated
  USING (
    porteiro_id = auth.uid() OR 
    is_current_user_admin()
  )
  WITH CHECK (
    porteiro_id = auth.uid() OR 
    is_current_user_admin()
  );

-- Policy for DELETE: Only admins can delete shifts
CREATE POLICY "porteiro_shifts_delete_policy" ON porteiro_shifts
  FOR DELETE TO authenticated
  USING (is_current_user_admin());

-- =====================================================
-- 6. CREATE TRIGGER FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_porteiro_shifts_updated_at
    BEFORE UPDATE ON porteiro_shifts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON porteiro_shifts TO authenticated;
GRANT DELETE ON porteiro_shifts TO authenticated; -- Controlled by RLS policy

-- Grant permissions to anon users (for public functions if needed)
GRANT EXECUTE ON FUNCTION get_active_porteiro(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_shift_overlap(UUID, UUID, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_porteiro() TO authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin_or_porteiro() TO authenticated;

-- =====================================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE porteiro_shifts IS 'Tabela para controle de turnos dos porteiros - sistema de ponto eletrônico';
COMMENT ON COLUMN porteiro_shifts.porteiro_id IS 'ID do porteiro (referência para profiles)';
COMMENT ON COLUMN porteiro_shifts.building_id IS 'ID do prédio onde o turno está sendo realizado';
COMMENT ON COLUMN porteiro_shifts.shift_start IS 'Data/hora de início do turno';
COMMENT ON COLUMN porteiro_shifts.shift_end IS 'Data/hora de fim do turno (NULL se ainda ativo)';
COMMENT ON COLUMN porteiro_shifts.status IS 'Status do turno: active, completed, interrupted';
COMMENT ON COLUMN porteiro_shifts.notes IS 'Observações sobre o turno';

COMMENT ON FUNCTION get_active_porteiro(UUID) IS 'Retorna o ID do porteiro ativo no prédio especificado';
COMMENT ON FUNCTION validate_shift_overlap(UUID, UUID, TIMESTAMP WITH TIME ZONE) IS 'Valida se não há sobreposição de turnos no mesmo prédio';
COMMENT ON FUNCTION auto_close_old_shifts() IS 'Fecha automaticamente turnos antigos (>24h) - para manutenção';

-- =====================================================
-- 9. VERIFICATION QUERIES (FOR TESTING)
-- =====================================================

-- Verify table creation
SELECT 'porteiro_shifts table created successfully' as status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'porteiro_shifts');

-- Verify RLS is enabled
SELECT 'RLS enabled on porteiro_shifts' as status
WHERE EXISTS (
  SELECT 1 FROM pg_tables 
  WHERE tablename = 'porteiro_shifts' 
  AND rowsecurity = true
);

-- Verify indexes created
SELECT 'Indexes created successfully' as status
WHERE EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'porteiro_shifts' 
  AND indexname = 'idx_porteiro_shifts_active'
);

-- Migration completed successfully
SELECT 'Migration 20250130_create_porteiro_shifts_system completed successfully' as final_status;