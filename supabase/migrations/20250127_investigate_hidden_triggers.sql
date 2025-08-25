-- Comprehensive investigation of all database objects that might reference resident_response_by
-- This will help identify the source of the persistent error

-- 1. Check ALL triggers in the database (not just visitor_logs)
SELECT 
    'ALL_TRIGGERS' as category,
    trigger_schema,
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE action_statement ILIKE '%resident_response_by%'
OR trigger_name ILIKE '%resident%'
ORDER BY trigger_name;

-- 2. Check ALL functions in the database
SELECT 
    'ALL_FUNCTIONS' as category,
    routine_schema,
    routine_name,
    routine_type,
    LEFT(routine_definition, 200) as definition_preview
FROM information_schema.routines 
WHERE routine_definition ILIKE '%resident_response_by%'
OR routine_definition ILIKE '%NEW.resident%'
OR routine_name ILIKE '%resident%'
ORDER BY routine_name;

-- 3. Check for any views that might have triggers
SELECT 
    'VIEWS_WITH_TRIGGERS' as category,
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE definition ILIKE '%resident_response_by%'
OR viewname ILIKE '%resident%';

-- 4. Check for any rules on visitor_logs table
SELECT 
    'TABLE_RULES' as category,
    rulename,
    definition
FROM pg_rules 
WHERE tablename = 'visitor_logs'
OR definition ILIKE '%resident_response_by%';

-- 5. Check for any policies that might be causing issues
SELECT 
    'RLS_POLICIES' as category,
    schemaname,
    tablename,
    policyname,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'visitor_logs'
OR qual ILIKE '%resident_response_by%'
OR with_check ILIKE '%resident_response_by%';

-- 6. Final check - look for any remaining references in pg_proc
SELECT 
    'PROCEDURES' as category,
    proname,
    prosrc
FROM pg_proc 
WHERE prosrc ILIKE '%resident_response_by%'
OR prosrc ILIKE '%NEW.resident%';