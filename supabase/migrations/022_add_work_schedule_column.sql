-- Add work_schedule column to profiles table for doorkeeper work hours
ALTER TABLE public.profiles 
ADD COLUMN work_schedule TEXT;

-- Add comment to the column
COMMENT ON COLUMN public.profiles.work_schedule IS 'Work schedule for doorkeepers (e.g., 08:00-18:00)';