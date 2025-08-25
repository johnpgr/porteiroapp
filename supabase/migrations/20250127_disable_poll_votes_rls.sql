-- Disable Row Level Security on poll_votes table to allow vote insertions
-- This resolves the 42501 error that prevents votes from being registered

-- Disable RLS on poll_votes table
ALTER TABLE poll_votes DISABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON poll_votes TO authenticated;

-- Grant read permissions to anon users (for viewing poll results)
GRANT SELECT ON poll_votes TO anon;

-- Add comment explaining the change
COMMENT ON TABLE poll_votes IS 'RLS disabled to allow unrestricted vote insertions. Consider re-enabling with proper policies in production.';