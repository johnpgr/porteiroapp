-- Migration: Clean up orphan data and add foreign key relationship
-- This resolves the PGRST200 error by first cleaning orphan records

-- Step 1: Clean up orphan records and add foreign key
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    -- Count orphan records
    SELECT COUNT(*) INTO orphan_count
    FROM apartment_residents ar 
    LEFT JOIN profiles p ON ar.profile_id = p.id 
    WHERE p.id IS NULL;
    
    RAISE NOTICE 'Found % orphan records in apartment_residents', orphan_count;
    
    -- Delete orphan records if any exist
    IF orphan_count > 0 THEN
        DELETE FROM apartment_residents 
        WHERE profile_id NOT IN (SELECT id FROM profiles WHERE id IS NOT NULL);
        
        RAISE NOTICE 'Cleaned up % orphan records', orphan_count;
    END IF;
    
    RAISE NOTICE 'Ready to add foreign key constraint';
END $$;

-- Step 2: Add foreign key constraint
ALTER TABLE public.apartment_residents 
ADD CONSTRAINT apartment_residents_profile_id_fkey 
FOREIGN KEY (profile_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Step 3: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_apartment_residents_profile_id 
ON public.apartment_residents(profile_id);

-- Step 4: Add comment explaining the relationship
COMMENT ON CONSTRAINT apartment_residents_profile_id_fkey ON public.apartment_residents 
IS 'Foreign key relationship linking apartment residents to their profile information';

-- Step 5: Verify the constraint was created
SELECT 
    'Foreign key created successfully' as status,
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
  AND tc.table_name = 'apartment_residents'
  AND kcu.column_name = 'profile_id';

-- Step 6: Verify data integrity
SELECT 
    'Data integrity check' as status,
    COUNT(*) as total_apartment_residents,
    COUNT(p.id) as valid_profile_references
FROM apartment_residents ar
LEFT JOIN profiles p ON ar.profile_id = p.id;