-- Migration: Add unique constraint to poll_votes table
-- Date: 2025-01-27
-- Description: Ensures each user can only vote once per poll

-- Add unique constraint to prevent duplicate votes from the same user on the same poll
ALTER TABLE poll_votes 
ADD CONSTRAINT unique_user_poll_vote 
UNIQUE (user_id, poll_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT unique_user_poll_vote ON poll_votes IS 'Ensures each user can only vote once per poll';

-- Create index for better performance on vote lookups
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_poll 
ON poll_votes(user_id, poll_id);

-- Verify the constraint was created
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'poll_votes'::regclass 
AND conname = 'unique_user_poll_vote';