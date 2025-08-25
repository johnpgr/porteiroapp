-- Final debug migration to identify and fix the persistent resident_response_by error
-- This migration will comprehensively search for and remove any remaining references

-- 1. Check for any remaining triggers on visitor_logs
SELECT 'TRIGGERS ON visitor_logs:' as debug_info;
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'visitor_logs'
ORDER BY trigger_name;

-- 2. Check for any functions that might reference resident_response_by
SELECT 'FUNCTIONS REFERENCING resident_response_by:' as debug_info;
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND (routine_definition ILIKE '%resident_response_by%'
       OR routine_definition ILIKE '%NEW.resident_response_by%'
       OR routine_definition ILIKE '%new.resident_response_by%')
ORDER BY routine_name;

-- 3. Drop any remaining problematic triggers and functions
DO $$
DECLARE
    trigger_record RECORD;
    function_record RECORD;
BEGIN
    -- Drop all triggers on visitor_logs table
    FOR trigger_record IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'visitor_logs'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON visitor_logs CASCADE', trigger_record.trigger_name);
        RAISE NOTICE 'Dropped trigger: %', trigger_record.trigger_name;
    END LOOP;
    
    -- Drop all functions that reference resident_response_by
    FOR function_record IN 
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public'
          AND (routine_definition ILIKE '%resident_response_by%'
               OR routine_definition ILIKE '%NEW.resident_response_by%'
               OR routine_definition ILIKE '%new.resident_response_by%')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I CASCADE', function_record.routine_name);
        RAISE NOTICE 'Dropped function: %', function_record.routine_name;
    END LOOP;
END $$;

-- 4. Verify that visitor_logs table has the resident_response_by column
SELECT 'VISITOR_LOGS COLUMNS:' as debug_info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'visitor_logs' 
  AND table_schema = 'public'
  AND column_name LIKE '%resident%'
ORDER BY ordinal_position;

-- 5. Check RLS policies on visitor_logs
SELECT 'RLS POLICIES ON visitor_logs:' as debug_info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'visitor_logs'
ORDER BY policyname;

-- 6. Final verification - list all remaining triggers and functions
SELECT 'FINAL VERIFICATION - REMAINING TRIGGERS:' as debug_info;
SELECT 
    trigger_name,
    event_object_table
FROM information_schema.triggers 
WHERE event_object_table = 'visitor_logs';

SELECT 'FINAL VERIFICATION - REMAINING FUNCTIONS WITH resident_response_by:' as debug_info;
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND (routine_definition ILIKE '%resident_response_by%'
       OR routine_definition ILIKE '%NEW.resident_response_by%'
       OR routine_definition ILIKE '%new.resident_response_by%');