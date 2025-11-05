# Database Migrations

## Running the voip_push_token Migration

1. **Option A: Via Supabase Dashboard**
   - Go to https://app.supabase.com/project/YOUR_PROJECT/editor
   - Open SQL Editor
   - Copy contents of `add_voip_push_token.sql`
   - Run the SQL

2. **Option B: Via Supabase CLI**
   ```bash
   # If not already logged in
   npx supabase login

   # Link to your project
   npx supabase link --project-ref YOUR_PROJECT_REF

   # Push migration
   npx supabase db push
   ```

3. **Regenerate TypeScript Types**
   After running the migration, update the types file:

   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > packages/common/supabase/types/database.ts
   ```

## Verification

After migration, verify the columns exist:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('push_token', 'voip_push_token');
```

Expected output:
```
column_name     | data_type
----------------|----------
push_token      | text
voip_push_token | text
```
