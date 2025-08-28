-- Migration: Add profile completion fields for simplified registration
-- This migration adds fields needed for the new token-free registration flow

-- Add new columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS temporary_password_used BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN profiles.profile_complete IS 'Indicates if the user has completed their full profile registration';
COMMENT ON COLUMN profiles.temporary_password_used IS 'Indicates if the user has used their temporary password and set a new one';

-- Update existing profiles to have profile_complete = true if they have essential data
UPDATE profiles 
SET profile_complete = true 
WHERE full_name IS NOT NULL 
  AND email IS NOT NULL 
  AND phone IS NOT NULL 
  AND cpf IS NOT NULL;

COMMIT;