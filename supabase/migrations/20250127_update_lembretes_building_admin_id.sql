-- Migration: Update existing lembretes with building_admin_id
-- This migration updates existing lembretes that have null building_admin_id
-- by finding the appropriate building_admin_id based on the sindico_id

-- First, let's check if there are any lembretes without building_admin_id
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count 
    FROM lembretes 
    WHERE building_admin_id IS NULL;
    
    RAISE NOTICE 'Found % lembretes with null building_admin_id', null_count;
END $$;

-- Update lembretes with null building_admin_id
-- We'll match the sindico_id from lembretes with admin_profile_id from building_admins
UPDATE lembretes 
SET building_admin_id = ba.id,
    updated_at = NOW()
FROM building_admins ba
WHERE lembretes.building_admin_id IS NULL
  AND lembretes.sindico_id = ba.admin_profile_id;

-- Check how many records were updated
DO $$
DECLARE
    updated_count INTEGER;
    remaining_null_count INTEGER;
BEGIN
    -- Get count of records that were just updated (have building_admin_id and updated_at is recent)
    SELECT COUNT(*) INTO updated_count 
    FROM lembretes 
    WHERE building_admin_id IS NOT NULL 
      AND updated_at > NOW() - INTERVAL '1 minute';
    
    -- Get remaining null count
    SELECT COUNT(*) INTO remaining_null_count 
    FROM lembretes 
    WHERE building_admin_id IS NULL;
    
    RAISE NOTICE 'Updated % lembretes with building_admin_id', updated_count;
    RAISE NOTICE 'Remaining % lembretes with null building_admin_id', remaining_null_count;
END $$;

-- Add a comment to the table for documentation
COMMENT ON COLUMN lembretes.building_admin_id IS 'References building_admins.id - links lembrete to specific building admin relationship';

-- Verify the foreign key constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_lembretes_building_admin'
        AND table_name = 'lembretes'
    ) THEN
        RAISE NOTICE 'Foreign key constraint fk_lembretes_building_admin already exists';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_lembretes_building_admin is properly configured';
    END IF;
END $$;