-- Migration: Add foreign key relationship between apartment_residents and profiles
-- This resolves the PGRST200 error: "Could not find a relationship between 'profiles' and 'apartment_residents'"

-- Add foreign key constraint from apartment_residents.profile_id to profiles.id
ALTER TABLE public.apartment_residents 
ADD CONSTRAINT apartment_residents_profile_id_fkey 
FOREIGN KEY (profile_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Create index for better performance on foreign key lookups
CREATE INDEX IF NOT EXISTS idx_apartment_residents_profile_id 
ON public.apartment_residents(profile_id);

-- Verify the foreign key was created successfully
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
  AND tc.table_name = 'apartment_residents'
  AND kcu.column_name = 'profile_id';

-- Comment explaining the relationship
COMMENT ON CONSTRAINT apartment_residents_profile_id_fkey ON public.apartment_residents 
IS 'Foreign key relationship linking apartment residents to their profile information';