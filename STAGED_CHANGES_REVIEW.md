# Staged Changes Review - PorteiroApp

**Date:** 2025-10-23
**Branch:** `develop` → `main`
**Files Changed:** 24 files (+1526, -1599)

---

## Executive Summary

Major refactor of Agora voice calling system with focus on:
- Security hardening (token auth, rate limiting)
- Architecture consolidation (deleted 610 lines of duplicate logic in morador/_layout)
- Improved token management (renewal, call-scoped tokens)
- Better separation of concerns (new IncomingCallModal, usePendingNotificationsCore)
- Comprehensive security testing

**Net Impact:** -73 lines, cleaner architecture, more secure

---

## 1. Security Enhancements ✅

### 1.1 Token Route Protection (`apps/interfone-api/src/routes/token.routes.ts`)

**Changes:**
- **NEW:** `requireAuth` middleware validates Supabase access tokens
- **NEW:** Rate limiting (60 req/min per IP)
- All token endpoints now require `Authorization: Bearer <token>`

**Files:**
- `token.routes.ts:10-31` - Auth middleware
- `token.routes.ts:33-57` - Rate limiter

**Impact:** Prevents unauthorized token generation attacks

**Issues Found:**
1. ❌ **In-memory rate limiter won't scale across processes**
   - Current: `Map<string, {count, windowStart}>`
   - Problem: Won't work with multiple API instances (no shared state)
   - Fix: Use Redis or Supabase-based rate limiting

2. ⚠️ **IP extraction needs improvement**
   ```typescript
   const ip = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
   ```
   - Missing array handling for `x-forwarded-for` (can be comma-separated)
   - Should use leftmost IP to prevent spoofing
   - Fix:
   ```typescript
   const forwardedFor = req.headers['x-forwarded-for'];
   const ip = Array.isArray(forwardedFor)
     ? forwardedFor[0]?.split(',')[0]?.trim()
     : typeof forwardedFor === 'string'
       ? forwardedFor.split(',')[0]?.trim()
       : req.ip || 'unknown';
   ```

3. ⚠️ **Rate limit buckets never cleared**
   - Memory leak: `rateBuckets` Map grows indefinitely
   - Fix: Implement bucket expiration/cleanup

### 1.2 New Token Endpoint (`apps/interfone-api/src/controllers/token.controller.ts:161-226`)

**NEW:** `generateTokenForCall(callId, uid, role?)`

**Security features:**
- Validates call exists
- Checks call status (rejects ended/declined)
- **Enforces participant authorization** (user must be doorman or participant)
- Binds token to existing channel

**Issues Found:**
1. ✅ Good: Participant validation prevents unauthorized access
2. ⚠️ **Loose type coercion:**
   ```typescript
   String(call.doorman_id) === String(uid)
   ```
   - Could mask bugs where types differ unexpectedly
   - Better: Validate types before comparison

### 1.3 Token Security Tests (`tests/src/token-security.test.ts`)

**NEW:** 185 lines of security validation tests

**Coverage:**
- ✅ Unauthorized access (401 without token)
- ✅ Invalid token (401 with bad token)
- ✅ Malformed headers
- ✅ Rate limiting (65 requests test)
- ✅ Public endpoints remain accessible

**Issues Found:**
1. ⚠️ **Tests skip authenticated scenarios** (lines 108, 113, 118)
   - Missing: Valid token acceptance tests
   - Missing: Participant validation tests
   - Missing: Call-scoped token generation tests
   - Fix: Add test user setup in `before()` hook

2. ⚠️ **Rate limit test may be flaky**
   ```typescript
   if (rateLimited.length > 0) { ... } else { console.log('⚠️ warning') }
   ```
   - Doesn't fail if rate limiting isn't triggered
   - Fix: Make assertion mandatory or skip test if infra doesn't support it

---

## 2. Architecture Improvements ✅

### 2.1 Massive Simplification: `apps/expo/app/morador/_layout.tsx`

**Deletions:**
- 645 lines removed (original: 653 lines → new: 151 lines)
- Deleted entire custom call handling logic
- Removed local state management for calls
- Removed realtime subscriptions
- Removed manual ringtone management

**Replacements:**
- Now uses `useAgora` hook (single source of truth)
- New `IncomingCallModal` component (182 lines, reusable)

**Benefits:**
- DRY principle: Logic now centralized in `useAgora`
- Easier to maintain (1 location vs 3+)
- Consistent behavior across user types

**Remaining Concerns:**
1. ⚠️ **Push notification handling simplified too much?**
   ```typescript
   // Line 89-91: Just logs, doesn't handle
   console.log('📞 Push notification received (foreground)');
   // useAgora will handle the call via RTM
   ```
   - Assumption: RTM always syncs before push notification arrives
   - Risk: If RTM disconnected, push notification gets ignored
   - Mitigation: RTM auto-reconnect added (see 2.3 below)

2. ⚠️ **Loss of explicit state tracking**
   - Old: `callActionRef.current = 'answered' | 'declined'`
   - New: Implicit in `useAgora` state
   - Could make debugging harder

### 2.2 Token Management Overhaul (`apps/expo/hooks/useAgora.ts`)

**Key Changes:**

1. **NEW: Token renewal hooks** (lines 435-467)
   ```typescript
   onTokenPrivilegeWillExpire: () => {
     fetchTokenForCall(...).then(bundle => engineRef.current?.renewToken(...))
   }
   onRequestToken: () => { /* same */ }
   ```
   - Prevents mid-call disconnections due to expired tokens
   - Uses new `/api/tokens/for-call` endpoint

2. **NEW: Call-scoped token fetching** (lines 291-330)
   ```typescript
   const fetchTokenForCall = async (baseUrl, { callId, uid, role })
   ```
   - Replaces generic `fetchTokenBundle`
   - Validates user is participant server-side

3. **Authorization headers added** (lines 272-281, 313)
   ```typescript
   const { data } = await supabase.auth.getSession();
   const accessToken = data?.session?.access_token;
   headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
   ```
   - Complies with new API auth requirements

4. **NEW: RTM auto-reconnection** (lines 1115-1169)
   - Exponential backoff (2s, 4s, 8s, 16s, 32s)
   - Max 5 retries
   - Prevents "RTM disconnected, call broken" scenarios

5. **NEW: Proactive RTM token renewal** (lines 1171-1249)
   - Renews 30 seconds before expiry
   - Prevents disconnection spikes

**Issues Found:**

1. ❌ **activeCallRef not always synced**
   ```typescript
   // Line 342: Ref declared
   const activeCallRef = useRef<ActiveCallContext | null>(null);

   // Line 712: Set in startCall
   activeCallRef.current = nextActive;

   // Line 843: Set in answerIncomingCall
   activeCallRef.current = nextActive;

   // Line 938: Cleared in endCall
   activeCallRef.current = null;
   ```
   - **Missing:** Not set in decline/error paths
   - **Missing:** Not cleared on RTM disconnect
   - Risk: Token renewal tries to fetch with stale callId
   - Fix: Add `activeCallRef.current = null` to all cleanup paths

2. ⚠️ **RTM reconnection depends on `rtmStatus` state**
   - Line 1118: `if (rtmStatus !== 'disconnected' || ...)`
   - Problem: If state doesn't update (race condition), won't reconnect
   - Fix: Add RTM connection health checks (ping/pong)

3. ⚠️ **Token renewal doesn't handle rejection**
   - Lines 442, 459: Just logs warnings on failure
   - Problem: Call continues with expired token → will disconnect
   - Better: Force call end with user notification

4. ✅ **Good:** Permissions check added before join (lines 544-548)
   ```typescript
   const granted = await agoraAudioService.requestPermissions();
   if (!granted) throw new Error('Permissão de microfone negada');
   ```

5. ⚠️ **Backward compatibility token fetch** (lines 755-761)
   ```typescript
   const bundle = answerResponse.data?.tokens
     ? answerResponse.data.tokens
     : await fetchTokenForCall(...);
   ```
   - Good: Supports old API responses
   - Problem: Inconsistent - answer endpoint doesn't return tokens yet
   - Fix: Update `/api/calls/:callId/answer` to include tokens in response

### 2.3 New Reusable Component: `IncomingCallModal` ✅

**File:** `apps/expo/components/IncomingCallModal.tsx` (182 lines)

**Props:**
```typescript
interface IncomingCallModalProps {
  visible?: boolean;
  onClose?: () => void;
  agoraContext?: UseAgoraReturn | null;
}
```

**Features:**
- Automatic ringtone management (starts on visible, stops on hide)
- Pulls data from `agoraContext.incomingInvite`
- Clean UI with lucide-react-native icons
- Handles accept/decline via agoraContext methods

**Issues Found:**
1. ✅ Good: Ringtone cleanup in useEffect return
2. ⚠️ **Empty catch blocks** (lines 54, 64)
   ```typescript
   } catch {
     // no-op; useAgora will set error state
   }
   ```
   - Silent failures could confuse users
   - Better: At least log to console for debugging

3. ⚠️ **isConnecting state not visualized in decline button**
   - Accept button shows "Conectando..." when disabled
   - Decline button doesn't reflect state
   - Could confuse users clicking decline during connection

---

## 3. Code Organization ✅

### 3.1 Extracted Core Logic: `usePendingNotificationsCore`

**File:** `packages/common/hooks/usePendingNotificationsCore.ts` (333 lines)

**Purpose:** Platform-agnostic visitor notification logic

**Exports:**
- `fetchPendingNotifications(deps)` - Fetch visitor approvals
- `respondToNotification(deps, id, response)` - Approve/reject with broadcast
- `subscribeToPendingNotifications(deps, callbacks)` - Realtime updates

**Features:**
- ✅ Broadcasts resident decisions to doorman via Realtime
- ✅ Channel timeout protection (7s)
- ✅ Clean separation from UI concerns

**Issues Found:**

1. ⚠️ **Broadcast channel never reused**
   ```typescript
   // Lines 80-108: Creates new channel for each broadcast
   const channel = supabase.channel(channelName, ...);
   await waitForChannelSubscription(channel);
   await channel.send(...);
   await supabase.removeChannel(channel);
   ```
   - Creates connection overhead
   - Could hit rate limits with many decisions
   - Better: Reuse channel or use postgres_changes trigger

2. ⚠️ **Fallback payload duplicates data** (lines 261-270)
   ```typescript
   if (!broadcastPayload) {
     broadcastPayload = {
       visitorLogId: notificationId,
       status: updateData.notification_status,
       // ... duplicate data
     };
   }
   ```
   - Inconsistent payload shape (decision vs visitorLogId)
   - Receivers need to handle both formats
   - Better: Always fetch or always use simple format

3. ⚠️ **Silent error swallowing** (lines 239-258)
   - If decision fetch fails, uses fallback
   - Doorman might get incomplete notification
   - Better: Throw error and show user "Decision saved but notification failed"

4. ✅ Good: Type safety with `TypedSupabaseClient`

### 3.2 Porteiro Layout Enhanced Decision Handling

**File:** `apps/expo/app/porteiro/_layout.tsx`

**Changes:**
- +191 lines of decision notification logic
- Filters by building_id (multi-tenant safety)
- Deduplicates using signature (`${id}-${status}-${responseBy}`)
- Fetches resident names in batch
- Shows native alerts for approved/rejected decisions

**Issues Found:**

1. ❌ **Infinite loop risk** (line 134)
   ```typescript
   const handleNewDecisions = async (decisions: any[]) => {
     // Filters, processes, alerts...
   }
   ```
   - Function recreated on every render
   - Used in subscription callback
   - Risk: Subscription re-setup on every state change
   - Fix: Wrap in `useCallback`

2. ⚠️ **Type safety lost with `any[]`**
   - Better: Define `ResidentDecision` interface

3. ⚠️ **Resident name fetch could fail silently** (lines 186-203)
   - If Supabase query fails, shows blank names
   - Better: Show "Morador [ID]" as fallback

---

## 4. Configuration & Documentation

### 4.1 EditorConfig Added ✅

**File:** `.editorconfig`

**Settings:**
- Unix line endings (LF)
- UTF-8 encoding
- 2-space indentation for JS/TS/JSON/CSS/HTML/MD

**Impact:** Prevents Git diffs from whitespace inconsistencies

### 4.2 Environment Variables Cleaned

**File:** `apps/expo/.env.example`

**Removed (22 lines deleted):**
- `SUPABASE_SERVICE_ROLE_KEY` - ❌ Never expose server keys in client!
- `EVOLUTION_*` - WhatsApp integration (server-only)
- `JWT_SECRET` - Server-only
- `PORT`, `NODE_ENV` - Server-only
- `ALLOWED_ORIGINS` - Server-only

**Added:**
- Comments in Portuguese explaining Agora App ID vs Certificate
- Better Android emulator URL (`http://10.0.2.2:3001`)

**Issues Found:**
1. ✅ Excellent: Removed security risk of service role key in client
2. ⚠️ **Still references `AGORA_APP_CERTIFICATE` in comments**
   - File: `apps/expo/.env.example:4`
   - Comment says "NÃO coloque o certificado aqui" (correct)
   - But might confuse developers - certificate never needed client-side
   - Fix: Remove mention entirely

### 4.3 Documentation Updates

**Files:**
- `README.md:182` - Added reference to `docs/agora-voice-plan.md`
- `docs/agora-voice-plan.md` - Major updates (diff truncated, needs review)

---

## 5. Component Deletions

### 5.1 Deleted: `AgoraCallComponent.tsx` (327 lines)
- Old standalone call UI
- Replaced by integrated `IncomingCallModal` + `useAgora`

### 5.2 Deleted: `IntercomCallModal.tsx` (283 lines)
- Old intercom-specific modal
- Logic absorbed into `IncomingCallModal`

**Impact:** -610 lines of deprecated code, cleaner codebase

---

## 6. Critical Issues Summary

### 🔴 High Priority

1. **Rate limiter won't work in production** (multi-process)
   - File: `apps/interfone-api/src/routes/token.routes.ts:33-57`
   - Fix: Switch to Redis/Supabase-based rate limiting

2. **activeCallRef sync issues in useAgora**
   - File: `apps/expo/hooks/useAgora.ts:342,712,843,938`
   - Fix: Set to null in all error/cleanup paths

3. **Missing authenticated test coverage**
   - File: `tests/src/token-security.test.ts:106-119`
   - Fix: Add valid token generation in test setup

### ⚠️ Medium Priority

4. **IP extraction vulnerable to spoofing**
   - File: `apps/interfone-api/src/routes/token.routes.ts:40`
   - Fix: Parse comma-separated `x-forwarded-for` correctly

5. **Rate limit bucket memory leak**
   - File: `apps/interfone-api/src/routes/token.routes.ts:35-57`
   - Fix: Add periodic cleanup or TTL

6. **Broadcast channel created per decision**
   - File: `packages/common/hooks/usePendingNotificationsCore.ts:80-108`
   - Fix: Reuse channel or use postgres triggers

7. **handleNewDecisions not memoized (infinite loop risk)**
   - File: `apps/expo/app/porteiro/_layout.tsx:76-238`
   - Fix: Wrap in `useCallback`

8. **Token renewal failures don't end call**
   - File: `apps/expo/hooks/useAgora.ts:442,459`
   - Fix: Force disconnect with user notification

### ℹ️ Low Priority

9. **Empty catch blocks in IncomingCallModal**
   - File: `apps/expo/components/IncomingCallModal.tsx:54,64`
   - Fix: Add console.error for debugging

10. **Inconsistent broadcastPayload shapes**
    - File: `packages/common/hooks/usePendingNotificationsCore.ts:223-270`
    - Fix: Standardize payload format

---

## 7. Recommended Fixes (Priority Order)

### Immediate (Before Merge)

```typescript
// 1. Fix rate limiter (apps/interfone-api/src/routes/token.routes.ts)
// Option A: Add cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateBuckets.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// Option B: Use Supabase (preferred for multi-instance)
// Track in `rate_limits` table with expires_at timestamp

// 2. Fix activeCallRef sync (apps/expo/hooks/useAgora.ts)
// Add to declineIncomingCall, error handlers, disconnect handlers:
activeCallRef.current = null;

// 3. Fix IP parsing (apps/interfone-api/src/routes/token.routes.ts)
const getClientIp = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) return forwardedFor[0]?.split(',')[0]?.trim() || 'unknown';
  if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0]?.trim() || 'unknown';
  return req.ip || 'unknown';
};
```

### Short-term (Next Sprint)

```typescript
// 4. Add authenticated tests (tests/src/token-security.test.ts)
before(async () => {
  const { data } = await client.post('/api/auth/test-login', {
    email: 'test@example.com',
    password: 'test123'
  });
  validAccessToken = data.access_token;
  testUserId = data.user.id;
});

// 5. Memoize handleNewDecisions (apps/expo/app/porteiro/_layout.tsx)
const handleNewDecisions = useCallback(async (decisions: any[]) => {
  // ... existing logic
}, [buildingId, notifiedSignaturesRef]);

// 6. Add token renewal failure handling (apps/expo/hooks/useAgora.ts)
onTokenPrivilegeWillExpire: () => {
  fetchTokenForCall(...)
    .then(...)
    .catch((e) => {
      console.error('Failed to renew token:', e);
      setError('Token expirado. Encerrando chamada...');
      void endCall();
    });
}
```

### Long-term (Refactoring)

- Move rate limiting to API gateway or Supabase Edge Functions
- Add comprehensive E2E tests for call flows
- Implement WebSocket health checks for RTM
- Add call quality metrics (Agora Stats API)

---

## 8. Testing Recommendations

### Before Deployment

1. **Run new security tests:**
   ```bash
   pnpm test:token-security
   ```

2. **Test token renewal:**
   - Start call
   - Wait 25+ minutes (token expiry)
   - Verify call stays connected

3. **Test RTM reconnection:**
   - Start call
   - Kill network for 10s
   - Verify call recovers

4. **Test rate limiting:**
   - Send 65 requests in 1 minute
   - Verify 429 responses

5. **Test multi-tenant isolation:**
   - User A in building 1 starts call
   - User B in building 2 tries to get token for call
   - Verify 403 Forbidden

### Regression Testing

- [ ] Morador can answer interfone call
- [ ] Morador can decline interfone call
- [ ] Porteiro receives decision notifications
- [ ] Push notifications work when app backgrounded
- [ ] Ringtone plays/stops correctly
- [ ] Call ends cleanly on both sides

---

## 9. Security Audit Checklist

- [x] Token endpoints require authentication
- [x] Rate limiting implemented
- [x] Participant authorization enforced
- [x] Service role key removed from client config
- [x] Tokens scoped to specific calls
- [ ] **TODO:** Rate limiter works in production (multi-instance)
- [ ] **TODO:** Token renewal failure handling
- [ ] **TODO:** IP spoofing protection
- [ ] **TODO:** Audit logging for token generation

---

## 10. Performance Considerations

### Positive Changes
- ✅ Reduced mobile bundle size (deleted 610 lines)
- ✅ Token renewal prevents re-joins (smoother UX)
- ✅ RTM auto-reconnect reduces dropped calls

### Potential Issues
- ⚠️ Broadcast channel creation overhead (1 per decision)
- ⚠️ Rate limit bucket cleanup missing (memory growth)
- ⚠️ Resident name batch fetch could slow with 100+ apartments

### Recommendations
- Add Redis for rate limiting + caching
- Implement pagination for decision notifications
- Monitor Agora token API latency

---

## Conclusion

**Overall Assessment: 👍 Strong Improvement**

This refactor significantly improves:
- **Security:** Auth + rate limiting critical for production
- **Maintainability:** -610 lines of duplicate code
- **Reliability:** Token renewal + RTM reconnection
- **Architecture:** Better separation of concerns

**Before Merge:**
- Fix critical rate limiter issue (won't work multi-instance)
- Add activeCallRef sync to error paths
- Improve IP parsing security

**Post-Merge:**
- Complete authenticated test coverage
- Implement token renewal failure handling
- Add E2E call tests

**Risk Level:** Medium (pending critical fixes)

**Recommendation:** Fix 3 high-priority issues, then merge to staging for QA testing.
