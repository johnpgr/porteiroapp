-- Debug migration to identify all triggers on visitor_logs table
-- This will help us find what's causing the resident_response_by error

-- List all triggers on visitor_logs
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_condition
FROM information_schema.triggers 
WHERE event_object_table = 'visitor_logs'
ORDER BY trigger_name;

-- List all functions that might be related to visitor_logs
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%visitor_logs%'
OR routine_definition ILIKE '%resident_response_by%'
ORDER BY routine_name;

-- Check if there are any other functions that reference NEW.resident_response_by
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%NEW.resident_response_by%'
OR routine_definition ILIKE '%new.resident_response_by%'
ORDER BY routine_name;