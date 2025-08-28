-- Migration: Fix apartment_residents table and update profiles structure
-- Date: 2025-01-28
-- Purpose: Add relationship column to apartment_residents and update profiles table structure

-- 1. Add relationship column to apartment_residents table
ALTER TABLE public.apartment_residents 
ADD COLUMN IF NOT EXISTS relationship VARCHAR(50) DEFAULT 'resident';

-- Add constraint for valid relationship values
ALTER TABLE public.apartment_residents 
ADD CONSTRAINT check_relationship_values 
CHECK (relationship IN ('owner', 'resident', 'tenant', 'family_member', 'guest', 'caretaker'));

-- Add index for relationship column
CREATE INDEX IF NOT EXISTS idx_apartment_residents_relationship 
ON public.apartment_residents (relationship);

-- Add comment to relationship column
COMMENT ON COLUMN public.apartment_residents.relationship IS 'Type of relationship with the apartment (owner, resident, tenant, family_member, guest, caretaker)';

-- 2. Drop existing profiles table if it exists and recreate with new structure
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table with complete structure
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  full_name TEXT NULL,
  avatar_url TEXT NULL,
  phone TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  email TEXT NULL,
  cpf TEXT NULL,
  work_schedule TEXT NULL,
  address TEXT NULL,
  birth_date TEXT NULL,
  building_id UUID NULL,
  role TEXT NULL,
  user_type TEXT NULL,
  relation TEXT NULL,
  emergency_contact_name TEXT NULL,
  emergency_contact_phone TEXT NULL,
  registration_token TEXT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_cpf_key UNIQUE (cpf),
  CONSTRAINT profiles_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for profiles table
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key 
ON public.profiles USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_profiles_registration_token 
ON public.profiles USING btree (registration_token) TABLESPACE pg_default
WHERE (registration_token IS NOT NULL);

-- 3. Create function to ensure first user gets is_owner=true
CREATE OR REPLACE FUNCTION public.set_first_resident_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the first resident for this apartment
  IF NOT EXISTS (
    SELECT 1 FROM public.apartment_residents 
    WHERE apartment_id = NEW.apartment_id 
    AND id != NEW.id
  ) THEN
    -- Set as owner if it's the first resident
    NEW.is_owner = true;
    NEW.relationship = 'owner';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set first resident as owner
DROP TRIGGER IF EXISTS trigger_set_first_resident_as_owner ON public.apartment_residents;
CREATE TRIGGER trigger_set_first_resident_as_owner
  BEFORE INSERT ON public.apartment_residents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_first_resident_as_owner();

-- 4. Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles table
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Grant permissions for apartment_residents table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apartment_residents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apartment_residents TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.profiles IS 'User profiles with extended information including registration tokens';
COMMENT ON COLUMN public.profiles.registration_token IS 'Token used for user registration process';
COMMENT ON COLUMN public.profiles.token_expires_at IS 'Expiration timestamp for registration token';
COMMENT ON FUNCTION public.set_first_resident_as_owner() IS 'Automatically sets the first resident of an apartment as owner';

-- Update existing apartment_residents to set relationship if null
UPDATE public.apartment_residents 
SET relationship = CASE 
  WHEN is_owner = true THEN 'owner'
  ELSE 'resident'
END
WHERE relationship IS NULL;

-- Success message
SELECT 'Migration completed successfully: apartment_residents and profiles tables updated' as status;