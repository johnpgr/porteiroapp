-- Migration: Fix doorkeeper_notifications INSERT policy
-- Add missing INSERT policy for doorkeeper_notifications table to allow system triggers to insert records

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "System can insert doorkeeper notifications" ON doorkeeper_notifications;
DROP POLICY IF EXISTS "Allow system to insert notifications" ON doorkeeper_notifications;
DROP POLICY IF EXISTS "Triggers can insert notifications" ON doorkeeper_notifications;

-- Create INSERT policy that allows system functions and triggers to insert records
-- This policy allows authenticated users (including system functions) to insert notifications
CREATE POLICY "System can insert doorkeeper notifications" ON doorkeeper_notifications
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Alternative: More restrictive policy that only allows inserts for buildings the user has access to
-- Uncomment this and comment the above if you want more restrictive access
/*
CREATE POLICY "System can insert doorkeeper notifications" ON doorkeeper_notifications
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    building_id IN (
      SELECT p.building_id 
      FROM profiles p 
      WHERE p.user_id = auth.uid() 
        AND p.user_type IN ('porteiro', 'admin')
    )
    OR 
    -- Allow system/trigger inserts (when auth.uid() is null in trigger context)
    auth.uid() IS NULL
  );
*/

-- Add comment explaining the policy
COMMENT ON POLICY "System can insert doorkeeper notifications" ON doorkeeper_notifications IS 
'Allows system triggers and authenticated users to insert doorkeeper notifications';

-- Verify the policy was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'doorkeeper_notifications' 
    AND policyname = 'System can insert doorkeeper notifications'
  ) THEN
    RAISE NOTICE 'INSERT policy for doorkeeper_notifications created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create INSERT policy for doorkeeper_notifications';
  END IF;
END $$;