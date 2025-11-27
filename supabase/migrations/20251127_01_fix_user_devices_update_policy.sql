-- Migration: Fix user_devices UPDATE policy missing WITH CHECK clause
-- Security fix: Prevents users from reassigning device tokens to other users
-- Without WITH CHECK, a user could UPDATE user_id to another user's ID and intercept their calls

-- Drop the insecure policy
DROP POLICY IF EXISTS "Users update own devices" ON public.user_devices;

-- Recreate with both USING and WITH CHECK clauses
-- USING: Only allows selecting rows owned by the user (pre-update check)
-- WITH CHECK: Ensures the row still belongs to the user after update (post-update check)
CREATE POLICY "Users update own devices"
ON public.user_devices
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add comment explaining the security requirement
COMMENT ON POLICY "Users update own devices" ON public.user_devices IS 
'Allows users to update only their own device rows. WITH CHECK prevents reassigning 
user_id to another user, which would allow intercepting their call notifications.';
