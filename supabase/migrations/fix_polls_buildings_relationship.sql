-- Adicionar foreign key constraint entre polls e buildings
ALTER TABLE polls 
ADD CONSTRAINT polls_building_id_fkey 
FOREIGN KEY (building_id) 
REFERENCES buildings(id) 
ON DELETE CASCADE;

-- Verificar se a constraint foi criada corretamente
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'polls'
  AND kcu.column_name = 'building_id';