-- Fix RLS policies for intercom_calls to allow service role operations
-- The service role is used by the interfone-api backend to create calls
-- Without this policy, the service role cannot insert records due to auth.uid() being NULL

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Doormen can manage their calls" ON intercom_calls;

CREATE POLICY "Doormen and service role can manage calls" ON intercom_calls
    FOR ALL USING (
        -- Allow if user is the doorman
        doorman_id = auth.uid()
        -- OR allow if using service role (authenticated role will be 'service_role')
        OR auth.role() = 'service_role'
    );
