-- Consultar turnos ativos
SELECT 
  ps.*,
  p.full_name as porteiro_name,
  b.name as building_name
FROM porteiro_shifts ps
JOIN profiles p ON ps.porteiro_id = p.id
JOIN buildings b ON ps.building_id = b.id
WHERE ps.status = 'active'
ORDER BY ps.shift_start DESC;

-- Consultar todos os turnos (últimos 10)
SELECT 
  ps.*,
  p.full_name as porteiro_name,
  b.name as building_name,
  CASE 
    WHEN ps.shift_end IS NULL THEN 'Ativo'
    ELSE EXTRACT(EPOCH FROM (ps.shift_end - ps.shift_start))/3600 || ' horas'
  END as duracao
FROM porteiro_shifts ps
JOIN profiles p ON ps.porteiro_id = p.id
JOIN buildings b ON ps.building_id = b.id
ORDER BY ps.shift_start DESC
LIMIT 10;

-- Verificar se há sobreposição de turnos
SELECT 
  ps1.id as turno1_id,
  ps1.porteiro_id,
  ps1.shift_start as turno1_inicio,
  ps1.shift_end as turno1_fim,
  ps2.id as turno2_id,
  ps2.shift_start as turno2_inicio,
  ps2.shift_end as turno2_fim
FROM porteiro_shifts ps1
JOIN porteiro_shifts ps2 ON ps1.porteiro_id = ps2.porteiro_id 
  AND ps1.id != ps2.id
  AND ps1.building_id = ps2.building_id
WHERE 
  -- Verificar sobreposição
  (ps1.shift_start <= COALESCE(ps2.shift_end, NOW()) 
   AND COALESCE(ps1.shift_end, NOW()) >= ps2.shift_start)