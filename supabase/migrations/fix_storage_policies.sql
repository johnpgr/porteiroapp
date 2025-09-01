-- Create delivery-visitor-photos bucket for photo uploads
-- This migration ensures the bucket exists with proper configuration

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-visitor-photos',
  'delivery-visitor-photos', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Note: RLS policies for storage.objects need to be configured manually
-- in the Supabase dashboard due to permission restrictions