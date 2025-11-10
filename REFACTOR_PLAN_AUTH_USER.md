# Refactor Plan: Replace AuthUser with Database Types

## Executive Summary
Replace custom `AuthUser` type with discriminated union of database types (`Tables<'profiles'> | Tables<'admin_profiles'>`). Remove unused Portuguese fields, remove always-null apartment fields, fix queries that incorrectly assume apartment_number exists on profiles table.

## Decisions Made
- **Type Strategy**: Discriminated union with `user_type` discriminator
- **Apartment Fields**: Remove completely, use `useUserApartment` hook
- **Portuguese Fields**: Remove completely (never used in code)
- **Migration**: Atomic refactor in single PR
- **Storage Compat**: Safe to break, users will re-login

## Key Findings from Analysis

### Current Issues
1. **Portuguese fields dead code**: `telefone`, `nome` defined but NEVER accessed
2. **Apartment fields always null**: `apartment_id`, `apartment_number` set to null in auth flow
3. **Real apartment data**: Fetched separately via `apartment_residents` join in 20+ files
4. **NotificationDashboard bug**: Queries `profiles.apartment_number` which doesn't exist in DB schema (lines 118, 143)

### Impact
- Only 2 files import AuthUser: `useAuth.tsx`, `TokenStorage.ts`
- Only 3 files access apartment fields from user object (all can use `useUserApartment` instead)
- All application code already uses English field names (`phone`, `full_name`)

---

## Changes by File

### 1. `apps/expo/types/auth.types.ts`

**Remove entire AuthUser interface, replace with:**

```typescript
import type { Tables } from '@porteiroapp/common/supabase';

export type AuthUserRole = 'morador' | 'porteiro' | 'admin' | 'visitante';

/**
 * Authenticated profile with user_type discriminator
 */
export type AuthProfile = Tables<'profiles'> & {
  user_type: 'morador' | 'porteiro';
};

/**
 * Authenticated admin profile with user_type discriminator
 */
export type AuthAdminProfile = Tables<'admin_profiles'> & {
  user_type: 'admin';
};

/**
 * Discriminated union of all authenticated user types
 */
export type AuthUser = AuthProfile | AuthAdminProfile;

/**
 * Type guards for discriminating user types
 */
export const isAdmin = (user: AuthUser): user is AuthAdminProfile =>
  user.user_type === 'admin';

export const isProfile = (user: AuthUser): user is AuthProfile =>
  user.user_type !== 'admin';

// Keep existing interfaces unchanged:
export interface TokenData { ... }
export interface SessionState { ... }
export interface StorageAdapter { ... }
```

**Key Changes:**
- ❌ Remove: `interface AuthUser`
- ❌ Remove: Portuguese fields (`telefone`, `nome`)
- ❌ Remove: Apartment fields (`apartment_id`, `apartment_number`)
- ❌ Remove: Custom field mappings (`profile_id`, `condominium_id`)
- ✅ Add: Type guards for type discrimination
- ✅ Keep: All other interfaces (TokenData, SessionState, StorageAdapter)

---

### 2. `apps/expo/hooks/useAuth.tsx`

#### 2.1 Remove Manual Field Mapping in `loadUserProfile()`

**Admin Profile Path (lines 414-448):**

```typescript
// BEFORE (lines 426-445):
userData = {
  id: authUser.id,
  profile_id: adminProfile.id,
  email: adminProfile.email,
  user_type: 'admin',
  condominium_id: null,
  building_id: null,
  telefone: adminProfile.phone,
  nome: adminProfile.full_name,
  is_active: adminProfile.is_active ?? true,
  last_login: new Date().toISOString(),
  push_token: adminProfile.push_token,
};

// AFTER:
const userData: AuthUser = {
  ...adminProfile,
  user_type: 'admin' as const,
};
```

**Regular Profile Path (lines 450-479):**

```typescript
// BEFORE (lines 463-477):
userData = {
  id: authUser.id,
  profile_id: profile.id,
  email: profile.email ?? '',
  user_type: (profile.user_type ?? profile.role ?? 'morador') as AuthUserRole,
  condominium_id: null,
  building_id: profile.building_id ?? null,
  apartment_id: null,
  apartment_number: null,
  nome: profile.full_name ?? null,
  telefone: profile.phone ?? null,
  is_active: true,
  last_login: shouldUpdateLogin ? now.toISOString() : profile.last_seen ?? null,
  push_token: profile.push_token ?? null,
};

// AFTER:
const userData: AuthUser = {
  ...profile,
  user_type: (profile.user_type ?? profile.role ?? 'morador') as AuthUserRole,
};
```

#### 2.2 Update TokenStorage Calls (lines 482-490)

```typescript
// BEFORE:
await TokenStorage.saveUserData({
  ...userData,
  role: userData.user_type === 'admin' ? 'admin'
    : userData.user_type === 'porteiro' ? 'porteiro'
    : 'morador',
});

// AFTER:
await TokenStorage.saveUserData(userData);
```

#### 2.3 Keep Unchanged
- `last_seen` update logic (lines 452-461) ✅
- `updated_at` update for admin profiles (lines 428-431) ✅
- All session management, offline mode, token refresh logic ✅
- `getCurrentUser` ref (line 53) - already correct type ✅

---

### 3. `apps/expo/services/TokenStorage.ts`

**Remove `StoredUserData` type:**

```typescript
// BEFORE:
interface StoredUserData extends AuthUser {
  role: AuthUserRole;
}

async getUserData(): Promise<StoredUserData | null>
async setUserData(user: AuthUser): Promise<void>

// AFTER:
async getUserData(): Promise<AuthUser | null>
async setUserData(user: AuthUser): Promise<void>
```

**Update storage implementation:**
- Remove `role` field mapping when saving
- Remove `role` field when loading
- Parse directly to `AuthUser` type
- Breaking change: existing cached users will be cleared on next login (acceptable)

---

### 4. Fix Files Accessing `apartment_number` from User

#### 4.1 `apps/expo/app/morador/authorize.tsx`

**Line 53:**
```typescript
// BEFORE:
.eq('apartment_number', user.apartment_number)

// AFTER:
// Add import at top:
import { useUserApartment } from '~/hooks/useUserApartment';

// Inside component:
const { apartment } = useUserApartment();

// In query:
.eq('apartment_number', apartment?.number)
```

#### 4.2 `apps/expo/app/morador/preregister.tsx`

**Line 137:**
```typescript
// BEFORE:
apartmentNumber: user.apartment_number || 'N/A'

// AFTER:
// Add import at top:
import { useUserApartment } from '~/hooks/useUserApartment';

// Inside component:
const { apartment } = useUserApartment();

// In field:
apartmentNumber: apartment?.number || 'N/A'
```

#### 4.3 `apps/expo/components/NotificationDashboard.tsx`

**CRITICAL BUG FIX - Query selects non-existent field:**

**Lines 102-120 - Fix Query:**
```typescript
// BEFORE (BROKEN - apartment_number doesn't exist on profiles):
const { data, error } = await supabase
  .from('notification_logs')
  .select(`
    id,
    notification_id,
    user_id,
    status,
    error_message,
    sent_at,
    notifications!inner (
      title,
      message,
      type
    ),
    profiles!inner (
      full_name,
      apartment_number
    )
  `)

// AFTER (JOIN with apartment_residents and apartments):
const { data, error } = await supabase
  .from('notification_logs')
  .select(`
    id,
    notification_id,
    user_id,
    status,
    error_message,
    sent_at,
    notifications!inner (
      title,
      message,
      type
    ),
    profiles!inner (
      full_name,
      apartment_residents!inner (
        apartments!inner (
          number
        )
      )
    )
  `)
```

**Lines 129-145 - Update Data Mapping:**
```typescript
// BEFORE:
const formattedLogs = data?.map(log => ({
  id: log.id,
  notification_id: log.notification_id,
  user_id: log.user_id,
  status: log.status,
  error_message: log.error_message,
  sent_at: log.sent_at,
  notification: {
    title: log.notifications.title,
    message: log.notifications.message,
    type: log.notifications.type
  },
  user: {
    name: log.profiles.full_name,
    apartment_number: log.profiles.apartment_number
  }
})) || [];

// AFTER:
const formattedLogs = data?.map(log => ({
  id: log.id,
  notification_id: log.notification_id,
  user_id: log.user_id,
  status: log.status,
  error_message: log.error_message,
  sent_at: log.sent_at,
  notification: {
    title: log.notifications.title,
    message: log.notifications.message,
    type: log.notifications.type
  },
  user: {
    name: log.profiles.full_name,
    apartment_number: log.profiles.apartment_residents?.apartments?.number || 'N/A'
  }
})) || [];
```

**Note:** This query assumes users have apartment_residents records. Add error handling if some users (like porteiros) don't have apartments.

---

### 5. Verify No Other Field Access Issues

**Run searches to confirm:**
```bash
# Should return no results:
grep -r "user\.telefone" apps/expo/
grep -r "user\.nome" apps/expo/
grep -r "\.profile_id" apps/expo/  # Check if accessing profile_id (should use .id)
```

**Expected:**
- `telefone`, `nome`: No usage (dead code confirmed)
- `profile_id`: May need to replace with `.id` in some places

---

## Migration Strategy

### Step 1: Update Type Definitions
1. Modify `apps/expo/types/auth.types.ts`
2. Add type guards
3. Ensure exports are correct

### Step 2: Update Auth Logic
1. Modify `apps/expo/hooks/useAuth.tsx`
   - Remove field mapping in `loadUserProfile()`
   - Return DB types directly
   - Remove role mapping in TokenStorage calls

### Step 3: Update Storage
1. Modify `apps/expo/services/TokenStorage.ts`
   - Remove `StoredUserData` type
   - Remove role field handling
   - Update method signatures

### Step 4: Fix Apartment Access
1. Update `morador/authorize.tsx` - add `useUserApartment` hook
2. Update `morador/preregister.tsx` - add `useUserApartment` hook
3. Fix `NotificationDashboard.tsx` query - add apartment joins

### Step 5: Test
1. Test admin login/logout
2. Test porteiro login/logout
3. Test morador login/logout
4. Test apartment-related features (authorize, preregister)
5. Test NotificationDashboard displays apartments correctly
6. Test offline mode
7. Test push notifications
8. Test session persistence

### Step 6: Verify Type Safety
```bash
cd apps/expo
npx tsc --noEmit
```

---

## Rollout Plan

### Pre-deployment
- ✅ All TypeScript compilation passes
- ✅ All tests pass
- ✅ Manual testing of all user types completed
- ✅ NotificationDashboard apartment display verified

### Deployment
- Deploy to staging environment
- Test with real users (all 3 types)
- Monitor for errors in logs
- Verify apartment data displays correctly

### Post-deployment
- Users may need to re-login (cached data cleared)
- Monitor error rates for 24 hours
- Verify no apartment_number null errors

---

## Risks & Mitigations

### Risk: Breaking Storage Format
- **Impact**: Users will be logged out on app update
- **Mitigation**: Acceptable - users simply re-login
- **Detection**: Monitor login rate spike after deployment

### Risk: NotificationDashboard Query Performance
- **Impact**: Nested joins may be slow
- **Mitigation**:
  - Add database index on `apartment_residents.profile_id`
  - Limit query to 50 records (already in place)
  - Consider caching apartment data
- **Detection**: Monitor query performance in logs

### Risk: Missing Apartment Data
- **Impact**: Some users (porteiros, admins) may not have apartment_residents records
- **Mitigation**: Add `|| 'N/A'` fallback in NotificationDashboard
- **Detection**: Test with porteiro and admin accounts

### Risk: Type Errors After Refactor
- **Impact**: Runtime errors if type guards fail
- **Mitigation**:
  - Comprehensive TypeScript compilation check
  - Runtime type validation in critical paths
- **Detection**: TypeScript compiler + runtime monitoring

---

## Testing Checklist

### Unit Tests
- [ ] Type guards work correctly (`isAdmin`, `isProfile`)
- [ ] TokenStorage save/load with new types
- [ ] Auth state management with DB types

### Integration Tests
- [ ] Admin login → correct type → correct routing
- [ ] Porteiro login → correct type → correct routing
- [ ] Morador login → correct type → correct routing
- [ ] Session refresh maintains correct type
- [ ] Offline mode with cached DB types

### E2E Tests
- [ ] morador/authorize filters by apartment correctly
- [ ] morador/preregister shows apartment correctly
- [ ] NotificationDashboard shows apartments correctly
- [ ] Push token registration works
- [ ] All user type features work end-to-end

### Manual Tests
- [ ] Login as admin - verify profile data
- [ ] Login as porteiro - verify profile data
- [ ] Login as morador - verify profile + apartment data
- [ ] Check NotificationDashboard with all user types
- [ ] Test offline mode → online recovery
- [ ] Test session expiry → re-login

---

## Database Migrations

### Required Index
```sql
-- Improve NotificationDashboard query performance
CREATE INDEX IF NOT EXISTS idx_apartment_residents_profile_id
ON apartment_residents(profile_id);
```

### Verify Schema
- ✅ `profiles` table has: `id, user_id, email, full_name, phone, building_id, push_token, user_type, role, last_seen`
- ✅ `admin_profiles` table has: `id, user_id, email, full_name, phone, push_token, role, is_active`
- ✅ `apartment_residents` table has: `profile_id, apartment_id`
- ✅ `apartments` table has: `id, number`

---

## Code Quality

### Before Refactor
- Custom AuthUser type with 15+ fields
- Portuguese field aliases (dead code)
- Null apartment fields (misleading)
- Field mapping in 2 places (duplication)
- NotificationDashboard query bug (selects non-existent field)

### After Refactor
- Direct use of DB types (single source of truth)
- No dead code
- No misleading fields
- No field mapping duplication
- NotificationDashboard query fixed

### Metrics
- **Lines removed**: ~100+ lines of mapping code
- **Type safety**: Improved (DB schema is source of truth)
- **Bugs fixed**: 1 critical (NotificationDashboard apartment query)
- **Dead code removed**: 2 fields (telefone, nome)
- **Misleading fields removed**: 2 fields (apartment_id, apartment_number)

---

## Success Criteria

1. ✅ TypeScript compilation passes with no errors
2. ✅ All 3 user types can login/logout
3. ✅ Apartment data displays correctly in all locations
4. ✅ NotificationDashboard shows apartment numbers
5. ✅ No runtime type errors in production
6. ✅ No performance degradation
7. ✅ Offline mode works correctly
8. ✅ Session persistence works correctly

---

## Timeline Estimate

- **Type definition changes**: 30 min
- **Auth hook refactor**: 1 hour
- **Storage service refactor**: 30 min
- **Fix apartment access sites**: 1 hour
- **Fix NotificationDashboard**: 1 hour
- **Testing**: 2 hours
- **Code review + fixes**: 1 hour
- **Total**: ~7 hours

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate**: Revert PR
2. **Cache**: Clear AsyncStorage for affected users (force re-login)
3. **Database**: No schema changes, safe to rollback
4. **Monitoring**: Check error rates return to baseline

---

## Post-Refactor Opportunities

### Future Improvements
1. Consider adding DB view for user+apartment data to simplify queries
2. Cache apartment data in auth context to reduce queries
3. Add runtime type validation library (zod) for extra safety
4. Migrate other Portuguese field names in codebase to English
5. Consider using Supabase RPC `get_apartment_residents` instead of manual joins

---

## Questions Resolved

1. ✅ **Type approach**: Discriminated union
2. ✅ **Apartment fields**: Remove, use useUserApartment hook
3. ✅ **Portuguese fields**: Remove (never used)
4. ✅ **Migration strategy**: Atomic refactor
5. ✅ **NotificationDashboard query**: Broken, needs apartment joins
6. ✅ **Storage compat**: Safe to break, users re-login

---

## References

- Database schema: `/home/joao/Work/porteiroapp/packages/common/supabase/types/database.ts`
- Auth types: `/home/joao/Work/porteiroapp/apps/expo/types/auth.types.ts`
- Auth hook: `/home/joao/Work/porteiroapp/apps/expo/hooks/useAuth.tsx`
- Storage service: `/home/joao/Work/porteiroapp/apps/expo/services/TokenStorage.ts`
- User apartment hook: `/home/joao/Work/porteiroapp/apps/expo/hooks/useUserApartment.ts`
