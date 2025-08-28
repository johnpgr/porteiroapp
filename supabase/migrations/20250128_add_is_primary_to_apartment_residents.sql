-- Migration: Add is_primary column to apartment_residents table
-- This migration fixes the PGRST204 error by adding the missing is_primary column
-- that is expected by the application code but missing from the database schema

-- Add the is_primary column to apartment_residents table
ALTER TABLE apartment_residents 
ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment to explain the purpose of the column
COMMENT ON COLUMN apartment_residents.is_primary IS 'Indicates if this resident is the primary resident for the apartment';

-- Create index for better performance on queries filtering by is_primary
CREATE INDEX idx_apartment_residents_is_primary ON apartment_residents(is_primary);

-- Create composite index for apartment_id and is_primary for efficient lookups
CREATE INDEX idx_apartment_residents_apartment_primary ON apartment_residents(apartment_id, is_primary);

-- Grant necessary permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON apartment_residents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON apartment_residents TO authenticated;

-- Ensure RLS policies are properly applied (if they exist)
-- The existing RLS policies should automatically apply to the new column

-- Optional: Set one resident per apartment as primary if none exists
-- This ensures data consistency for existing records
WITH primary_residents AS (
  SELECT DISTINCT ON (apartment_id) 
    id,
    apartment_id
  FROM apartment_residents 
  ORDER BY apartment_id, created_at ASC
)
UPDATE apartment_residents 
SET is_primary = TRUE 
WHERE id IN (SELECT id FROM primary_residents)
  AND NOT EXISTS (
    SELECT 1 
    FROM apartment_residents ar2 
    WHERE ar2.apartment_id = apartment_residents.apartment_id 
      AND ar2.is_primary = TRUE
  );