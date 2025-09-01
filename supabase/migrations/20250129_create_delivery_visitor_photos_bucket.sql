-- Create bucket for delivery and visitor photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-visitor-photos',
  'delivery-visitor-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- RLS Policies for the bucket
CREATE POLICY "Authenticated users can upload delivery/visitor photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'delivery-visitor-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Public can view delivery/visitor photos" ON storage.objects
FOR SELECT USING (bucket_id = 'delivery-visitor-photos');

CREATE POLICY "Users can update their own delivery/visitor photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'delivery-visitor-photos' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own delivery/visitor photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'delivery-visitor-photos' AND
  auth.role() = 'authenticated'
);

-- Grant permissions to anon and authenticated roles
GRANT SELECT ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;