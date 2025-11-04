# Auth Optimization Plan - PorteiroApp

**Date**: 2025-11-03
**Scope**: All 3 phases - Security + Performance + Offline Support
**Estimated Time**: 11-14 hours
**Current Progress**: Phases 1-3 completed (Security, Performance, Offline) – preparing to execute Phase 4 analytics

---

## Current State Analysis

### Performance Bottlenecks
- **Cold start**: 4-16 seconds
- **Warm start**: 4-7 seconds (should be <1s with cached data)

### Root Causes
1. **Sequential loading** - session check → DB query (waterfall pattern)
2. **No optimistic rendering** - always waits for network even with valid cache
3. **Artificial delays** - 2.6s of intentional setTimeout delays
4. **Heavy service init** - Agora RTM starts before UI visible
5. **Frequent heartbeat** - DB updates every 5 minutes

### Critical Security Issue
🔴 **Access tokens stored in plain AsyncStorage** (unencrypted)
- Location: `apps/expo/services/TokenStorage.ts`
- Risk: Anyone with device access can read tokens
- Must migrate to expo-secure-store (hardware-encrypted)

---

## Phase 1: Security - SecureStore Migration

**Time Estimate**: 4-5 hours

### 1.1 Dependencies & Setup

**Add packages**:
```bash
pnpm add expo-secure-store @react-native-community/netinfo
```

**Create feature flag**:
- Supabase table: `app_config`
- Schema:
  ```sql
  CREATE TABLE app_config (
    feature_key TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  INSERT INTO app_config (feature_key, enabled)
  VALUES ('use_secure_store', true);
  ```

### 1.2 TokenStorage Refactor

**File**: `apps/expo/services/TokenStorage.ts`

**Strategy**: Hybrid approach
- Access tokens → **SecureStore** (encrypted, hardware-backed)
- User data → **AsyncStorage** (non-sensitive, faster)
- Refresh tokens → **AsyncStorage** (Supabase handles encryption)

**Key Changes**:

1. **Add SecureStore wrapper with 2KB split handling**:
```typescript
import * as SecureStore from 'expo-secure-store';

// Handle tokens >2KB (SecureStore iOS limit)
const CHUNK_SIZE = 1800; // Leave buffer
const saveTokenSecurely = async (key: string, value: string) => {
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    await SecureStore.deleteItemAsync(`${key}_chunk_count`);
  } else {
    // Split into chunks
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}_chunk_count`, String(chunks));

    for (let i = 0; i < chunks; i++) {
      const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
    }
  }
};

const getTokenSecurely = async (key: string): Promise<string | null> => {
  const chunkCount = await SecureStore.getItemAsync(`${key}_chunk_count`);

  if (!chunkCount) {
    return await SecureStore.getItemAsync(key);
  }

  // Reassemble chunks
  const chunks = parseInt(chunkCount, 10);
  let value = '';
  for (let i = 0; i < chunks; i++) {
    const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
    if (chunk) value += chunk;
  }
  return value || null;
};
```

2. **Auto-migration from AsyncStorage**:
```typescript
const migrateToSecureStore = async (): Promise<void> => {
  try {
    // Check if already migrated
    const migrated = await AsyncStorage.getItem('@porteiro_app:migrated_to_secure');
    if (migrated === 'true') return;

    // Get old AsyncStorage token
    const oldToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (oldToken) {
      // Save to SecureStore
      await saveTokenSecurely(TOKEN_KEY, oldToken);
      // Clear from AsyncStorage
      await AsyncStorage.removeItem(TOKEN_KEY);
    }

    // Mark as migrated
    await AsyncStorage.setItem('@porteiro_app:migrated_to_secure', 'true');
    console.log('[Migration] Successfully migrated to SecureStore');
  } catch (error) {
    console.error('[Migration] Failed to migrate to SecureStore:', error);
    // Don't throw - fallback to AsyncStorage
  }
};
```

3. **Fallback logic for SecureStore failures**:
```typescript
const saveToken = async (token: string): Promise<void> => {
  // Check feature flag
  const useSecureStore = await FeatureFlags.isEnabled('use_secure_store');

  if (useSecureStore) {
    try {
      await saveTokenSecurely(TOKEN_KEY, token);
      return;
    } catch (error) {
      console.error('[TokenStorage] SecureStore failed, falling back to AsyncStorage:', error);
      // Fall through to AsyncStorage
    }
  }

  // Fallback: AsyncStorage
  await AsyncStorage.setItem(TOKEN_KEY, token);
};
```

4. **Try-catch with re-login on corruption**:
```typescript
const getUserData = async (): Promise<AuthUser | null> => {
  try {
    const data = await AsyncStorage.getItem(USER_DATA_KEY);
    if (!data) return null;

    const parsed = JSON.parse(data);
    // Validate schema
    if (!parsed.id || !parsed.email) {
      throw new Error('Invalid user data schema');
    }
    return parsed;
  } catch (error) {
    console.error('[TokenStorage] Corrupted user data, clearing:', error);
    await clearAll(); // Force fresh login
    return null;
  }
};
```

### 1.3 Native Module Bridge (iOS + Android)

**Purpose**: Allow foreground services to access tokens from native code

**Create module**: `apps/expo/modules/SecureTokenStorage/`

**iOS Implementation** (`ios/SecureTokenStorage.swift`):
```swift
import ExpoModulesCore
import ExpoSecureStore

public class SecureTokenStorage: Module {
  public func definition() -> ModuleDefinition {
    Name("SecureTokenStorage")

    AsyncFunction("getToken") { (key: String) -> String? in
      return try? SecureStore.getValueWithKey(key, options: [:])
    }

    AsyncFunction("setToken") { (key: String, value: String) in
      try SecureStore.setValueWithKey(value, key: key, options: [:])
    }
  }
}
```

**Android Implementation** (`android/SecureTokenStorage.kt`):
```kotlin
package expo.modules.securetokenstorage

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.securestore.SecureStoreModule

class SecureTokenStorage : Module() {
  override fun definition() = ModuleDefinition {
    Name("SecureTokenStorage")

    AsyncFunction("getToken") { key: String ->
      // Access SecureStore from native
      secureStore.getValueWithKey(key, null)
    }

    AsyncFunction("setToken") { key: String, value: String ->
      secureStore.setValueWithKey(value, key, null)
    }
  }
}
```

**Expo config** (`app.json`):
```json
{
  "expo": {
    "plugins": [
      [
        "expo-secure-store"
      ]
    ]
  }
}
```

### 1.4 Bug Fix

**File**: `apps/expo/services/intercomCallService.ts`

**Line 350, 379**: Replace hardcoded `'current_user_id'`

```typescript
// Before:
const userId = 'current_user_id'; // ❌ Hardcoded

// After:
import { getCurrentUser } from '../hooks/useAuth';

const userId = getCurrentUser()?.id; // ✅ Real user ID
if (!userId) {
  console.error('[IntercomCall] No authenticated user');
  return;
}
```

**Add to useAuth.tsx**:
```typescript
// Export getter for services
let currentUserRef: AuthUser | null = null;

export const getCurrentUser = (): AuthUser | null => currentUserRef;

// Update in AuthProvider
useEffect(() => {
  currentUserRef = user;
}, [user]);
```

### 1.5 Strict TypeScript Types

**Create**: `apps/expo/types/auth.types.ts`

```typescript
export interface AuthUser {
  id: string;
  email: string;
  user_type: 'morador' | 'porteiro' | 'admin' | 'visitante';
  building_id?: string;
  apartment_number?: string;
  nome?: string;
  telefone?: string;
  created_at?: string;
  last_login?: string;
}

export interface TokenData {
  token: string;
  expiresAt: number; // Unix timestamp
  issuedAt: number;
}

export interface SessionState {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  isReadOnly: boolean; // Soft logout mode
}

export interface StorageAdapter {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  getUserData(): Promise<AuthUser | null>;
  setUserData(user: AuthUser): Promise<void>;
  clearAll(): Promise<void>;
}
```

---

## Phase 2: Performance - Optimistic Loading

**Time Estimate**: 4-5 hours

### 2.1 Optimistic Auth Flow

**File**: `apps/expo/hooks/useAuth.tsx`

**Key changes**:

1. **Load cached user immediately (no await)**:
```typescript
const [user, setUser] = useState<AuthUser | null>(null);
const [loading, setLoading] = useState(false); // ✅ Start false, not true

useEffect(() => {
  const initAuth = async () => {
    // 1. Load cached user immediately (don't await)
    TokenStorage.getUserData().then(cachedUser => {
      if (cachedUser) {
        setUser(cachedUser);
        console.log('[Auth] Optimistic load from cache:', cachedUser.email);
      }
    });

    // 2. Validate session in background (don't block UI)
    checkSession(); // Don't await
  };

  initAuth();
}, []);
```

2. **Background session validation**:
```typescript
const checkSession = async () => {
  try {
    setLoading(true);

    // Check if online
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('[Auth] Offline - using cached session');
      await handleOfflineSession();
      return;
    }

    // Get Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (session?.user) {
      // Only fetch profile if cache is empty or stale
      if (!user) {
        await loadUserProfile(session.user.id);
      }
    } else {
      // No valid session - clear cache
      setUser(null);
      await TokenStorage.clearAll();
    }
  } catch (error) {
    console.error('[Auth] Session check failed:', error);
    await handleOfflineSession();
  } finally {
    setLoading(false);
  }
};
```

3. **Lazy on-demand token refresh**:
```typescript
// Call before every API request
export const ensureFreshToken = async (): Promise<string | null> => {
  const token = await TokenStorage.getToken();
  if (!token) return null;

  // Check if expires in <10 minutes
  if (isTokenExpiringSoon(token, 10 * 60)) {
    console.log('[Auth] Token expiring soon, refreshing...');

    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('[Auth] Token refresh failed:', error);
      return null;
    }

    if (data?.session?.access_token) {
      await TokenStorage.saveToken(data.session.access_token);
      return data.session.access_token;
    }
  }

  return token;
};

// Helper
const isTokenExpiringSoon = (token: string, bufferSeconds: number): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    return (expiresAt - now) < bufferSeconds;
  } catch {
    return true; // Assume expired if can't parse
  }
};
```

### 2.2 Remove Artificial Delays

**File 1**: `apps/expo/app/index.tsx`

```typescript
// Line 20 - DELETE:
await new Promise(resolve => setTimeout(resolve, 2500)); // ❌ Remove

// Replace with:
// (nothing - just remove the delay)
```

**File 2**: `apps/expo/app/_layout.tsx`

```typescript
// Line 90 - DELETE:
await new Promise(resolve => setTimeout(resolve, 100)); // ❌ Remove

// Replace with:
// (nothing - just remove the delay)
```

### 2.3 Remove Heartbeat System

**File**: `apps/expo/hooks/useAuth.tsx`

**Delete lines 167-196** (entire heartbeat logic):
```typescript
// ❌ DELETE:
const startHeartbeat = () => {
  heartbeatTimerRef.current = setInterval(async () => {
    // ... DB updates every 5 minutes
  }, HEARTBEAT_INTERVAL);
};

const stopHeartbeat = () => {
  if (heartbeatTimerRef.current) {
    clearInterval(heartbeatTimerRef.current);
  }
};

// Remove all calls to startHeartbeat() and stopHeartbeat()
```

**Rely on**:
- Supabase `autoRefreshToken: true`
- AppState listeners (already implemented)
- On-demand token refresh before API calls

### 2.4 Lazy Service Initialization

**File 1**: `apps/expo/app/_layout.tsx`

**Move PushTokenManager to lazy trigger**:
```typescript
// Before (line 22-76): Renders immediately
<PushTokenManager user={user} />

// After: Trigger after first auth success
const [pushTokenRegistered, setPushTokenRegistered] = useState(false);

useEffect(() => {
  if (user && !pushTokenRegistered) {
    registerPushToken(user);
    setPushTokenRegistered(true);
  }
}, [user, pushTokenRegistered]);
```

**File 2**: `apps/expo/app/morador/_layout.tsx`

**Lazy Agora initialization (move from useAuth)**:
```typescript
// Lines 66-73: Move Agora init here from useAuth.tsx
const [agoraInitialized, setAgoraInitialized] = useState(false);

useEffect(() => {
  if (user && !agoraInitialized) {
    console.log('[Morador] Initializing Agora on layout mount');
    agoraService.setCurrentUser({
      id: user.id,
      userType: user.user_type,
      displayName: user.nome || user.email,
    });
    setAgoraInitialized(true);
  }
}, [user, agoraInitialized]);
```

**File 3**: `apps/expo/hooks/useAuth.tsx`

**Remove Agora init from useAuth** (lines 734-754):
```typescript
// ❌ DELETE: Don't initialize Agora in useAuth anymore
useEffect(() => {
  if (user) {
    agoraService.setCurrentUser({ ... });
  }
}, [user]);
```

### 2.5 Profile Caching Strategy

**File**: `apps/expo/hooks/useAuth.tsx`

**Only fetch profile on login or manual refresh**:
```typescript
const loadUserProfile = async (userId: string, forceRefresh = false) => {
  // Skip if we have cached user and not forcing refresh
  if (user && !forceRefresh) {
    console.log('[Auth] Using cached profile');
    return;
  }

  // Fetch from DB
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profile) {
    setUser(profile);
    await TokenStorage.saveUserData(profile);
  }
};

// Expose manual refresh
const refreshUserProfile = async () => {
  if (!user?.id) return;
  await loadUserProfile(user.id, true);
};
```

**Invalidate cache only on logout**:
```typescript
const logout = async () => {
  await supabase.auth.signOut();
  await TokenStorage.clearAll(); // ✅ Only place cache is cleared
  setUser(null);
};
```

---

## Phase 3: Offline Support

**Time Estimate**: 3-4 hours

### 3.1 Network Detection

**Create**: `apps/expo/services/NetworkMonitor.ts`

```typescript
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export const useNetworkState = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
      console.log('[Network]', state.isConnected ? 'Online' : 'Offline');
    });

    return unsubscribe;
  }, []);

  return isOnline;
};

// Exponential backoff for retries
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i); // 1s, 2s, 4s
      console.log(`[Retry] Attempt ${i + 1} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
};
```

### 3.2 Local Token Validation (24h Offline Grace Period)

**File**: `apps/expo/hooks/useAuth.tsx`

```typescript
const OFFLINE_GRACE_PERIOD = 24 * 60 * 60 * 1000; // 24 hours

const handleOfflineSession = async () => {
  const cachedToken = await TokenStorage.getToken();
  const cachedUser = await TokenStorage.getUserData();

  if (!cachedToken || !cachedUser) {
    console.log('[Auth] No cached session for offline mode');
    setUser(null);
    return;
  }

  // Validate token locally (no network)
  const isValidLocally = isTokenValidLocally(cachedToken);

  if (isValidLocally) {
    // Check last successful auth timestamp
    const lastAuthTime = await AsyncStorage.getItem('@porteiro_app:last_auth_time');
    const timeSinceAuth = Date.now() - parseInt(lastAuthTime || '0', 10);

    if (timeSinceAuth < OFFLINE_GRACE_PERIOD) {
      console.log('[Auth] Offline mode - using cached session (grace period active)');
      setUser(cachedUser);
      setIsOffline(true); // New state
      return;
    }
  }

  // Grace period expired or token invalid
  console.log('[Auth] Offline grace period expired - soft logout');
  await handleSoftLogout();
};

const isTokenValidLocally = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    return expiresAt > now;
  } catch {
    return false;
  }
};

// Update timestamp on successful auth
const updateLastAuthTime = async () => {
  await AsyncStorage.setItem('@porteiro_app:last_auth_time', String(Date.now()));
};
```

### 3.3 Inactivity Timeout (24h)

**File**: `apps/expo/hooks/useAuth.tsx`

```typescript
const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const inactivityTimerRef = useRef<NodeJS.Timeout>();

useEffect(() => {
  const subscription = AppState.addEventListener('change', nextAppState => {
    if (nextAppState === 'active') {
      // App came to foreground - reset inactivity timer
      resetInactivityTimer();

      // Refresh session if online
      if (user) {
        checkSession();
      }
    }
  });

  return () => subscription.remove();
}, [user]);

const resetInactivityTimer = () => {
  if (inactivityTimerRef.current) {
    clearTimeout(inactivityTimerRef.current);
  }

  if (user) {
    inactivityTimerRef.current = setTimeout(() => {
      console.log('[Auth] Inactivity timeout - logging out');
      logout();
    }, INACTIVITY_TIMEOUT);
  }
};
```

### 3.4 Soft Logout / Read-Only Mode

**File**: `apps/expo/hooks/useAuth.tsx`

```typescript
const [isReadOnly, setIsReadOnly] = useState(false);

const handleSoftLogout = async () => {
  console.log('[Auth] Soft logout - read-only mode active');
  setIsReadOnly(true);
  // Keep user in state for read access to cached data
  // Don't clear TokenStorage - allow re-auth without losing cache
};

// Update auth context
export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isOffline: boolean;
  isReadOnly: boolean; // New
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  ensureFreshToken: () => Promise<string | null>;
}
```

**Read-only UI wrapper**:
```typescript
export const ReadOnlyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReadOnly } = useAuth();

  if (isReadOnly) {
    return (
      <View>
        <Banner variant="warning">
          Re-login required - viewing cached data only
        </Banner>
        {children}
      </View>
    );
  }

  return <>{children}</>;
};
```

**Allowed in read-only mode**:
- View cached notifications (from AsyncStorage)
- View resident profile (from cache)
- View call history (from cache)

**Blocked in read-only mode**:
- Make calls (Agora interactions)
- Update profile
- Send notifications
- Any mutations

### 3.5 Offline Notification Queue

**Create**: `apps/expo/services/OfflineQueue.ts`

```typescript
const QUEUE_KEY = '@porteiro_app:offline_queue';

interface QueuedNotification {
  id: string;
  type: 'notification_received' | 'deep_link';
  payload: any;
  timestamp: number;
}

export const queueNotification = async (notification: Omit<QueuedNotification, 'timestamp'>) => {
  const queue = await getQueue();
  queue.push({
    ...notification,
    timestamp: Date.now(),
  });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const processQueue = async () => {
  const queue = await getQueue();

  for (const item of queue) {
    try {
      await processQueuedItem(item);
    } catch (error) {
      console.error('[Queue] Failed to process item:', item.id, error);
    }
  }

  // Clear queue after processing
  await AsyncStorage.removeItem(QUEUE_KEY);
};

const getQueue = async (): Promise<QueuedNotification[]> => {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  return data ? JSON.parse(data) : [];
};
```

**File**: `apps/expo/hooks/useAuth.tsx`

```typescript
// Process queue when coming back online
useEffect(() => {
  if (isOnline && !wasOnline.current) {
    console.log('[Auth] Back online - processing offline queue');
    processQueue();
  }
  wasOnline.current = isOnline;
}, [isOnline]);
```

### 3.6 Deep Link Queuing

**File**: `apps/expo/app/_layout.tsx`

```typescript
const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);

useEffect(() => {
  const handleDeepLink = async (event: { url: string }) => {
    if (!user) {
      // Queue deep link for after auth
      console.log('[DeepLink] User not authenticated, queuing:', event.url);
      setPendingDeepLink(event.url);
      await AsyncStorage.setItem('@porteiro_app:pending_deep_link', event.url);
    } else {
      // Process immediately
      await processDeepLink(event.url);
    }
  };

  const subscription = Linking.addEventListener('url', handleDeepLink);
  return () => subscription.remove();
}, [user]);

// Process pending deep link after auth
useEffect(() => {
  if (user && pendingDeepLink) {
    console.log('[DeepLink] Processing queued deep link:', pendingDeepLink);
    processDeepLink(pendingDeepLink);
    setPendingDeepLink(null);
    AsyncStorage.removeItem('@porteiro_app:pending_deep_link');
  }
}, [user, pendingDeepLink]);
```

---

## Phase 4: Analytics & Monitoring

**Time Estimate**: 2 hours

### 4.1 Performance Tracking

**Create**: `apps/expo/services/AnalyticsTracker.ts`

```typescript
interface PerformanceMetric {
  event: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class AnalyticsTracker {
  private startTimes: Map<string, number> = new Map();

  startTiming(event: string) {
    this.startTimes.set(event, Date.now());
    console.log(`[Metrics] Started: ${event}`);
  }

  endTiming(event: string, metadata?: Record<string, any>) {
    const startTime = this.startTimes.get(event);
    if (!startTime) {
      console.warn(`[Metrics] No start time for: ${event}`);
      return;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(event);

    const metric: PerformanceMetric = {
      event,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    console.log(`[Metrics] ${event}: ${duration}ms`, metadata);

    // Send to analytics service (optional)
    // this.sendToAnalytics(metric);
  }

  trackEvent(event: string, metadata?: Record<string, any>) {
    console.log(`[Analytics] ${event}`, metadata);
    // Send to analytics service
  }
}

export default new AnalyticsTracker();
```

**File**: `apps/expo/hooks/useAuth.tsx`

```typescript
import AnalyticsTracker from '../services/AnalyticsTracker';

useEffect(() => {
  const initAuth = async () => {
    AnalyticsTracker.startTiming('auth_startup_complete');

    // ... optimistic load, session check

    AnalyticsTracker.endTiming('auth_startup_complete', {
      hasCachedUser: !!cachedUser,
      isOnline,
    });
  };

  initAuth();
}, []);
```

**Track critical paths**:
- `auth_startup_complete` - TTI (time to interactive)
- `auth_cache_load_duration` - How long to load from cache
- `auth_session_validate_duration` - Session validation time
- `auth_profile_fetch_duration` - Profile DB query time
- `auth_token_refresh_duration` - Token refresh latency
- `auth_migration_completed` - SecureStore migration success/failure
- `auth_offline_mode_entered` - Offline grace period activation
- `auth_soft_logout` - Read-only mode activation

### 4.2 Feature Flag System

**Create**: `apps/expo/services/FeatureFlags.ts`

```typescript
interface FeatureFlag {
  key: string;
  enabled: boolean;
  metadata?: any;
}

class FeatureFlagService {
  private cache: Map<string, boolean> = new Map();
  private lastFetch: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async isEnabled(key: string): Promise<boolean> {
    // Check cache first
    if (this.cache.has(key) && Date.now() - this.lastFetch < this.CACHE_TTL) {
      return this.cache.get(key)!;
    }

    // Fetch from Supabase
    await this.fetchFlags();
    return this.cache.get(key) ?? false;
  }

  private async fetchFlags() {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('feature_key, enabled');

      if (error) throw error;

      // Update cache
      this.cache.clear();
      data?.forEach(flag => {
        this.cache.set(flag.feature_key, flag.enabled);
      });

      this.lastFetch = Date.now();
      console.log('[FeatureFlags] Loaded:', this.cache.size, 'flags');
    } catch (error) {
      console.error('[FeatureFlags] Failed to fetch:', error);
      // Keep stale cache on error
    }
  }

  // Preload on app start
  async preload() {
    await this.fetchFlags();
  }
}

export default new FeatureFlagService();
```

**Supabase table schema**:
```sql
CREATE TABLE app_config (
  feature_key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial flags
INSERT INTO app_config (feature_key, enabled, description) VALUES
  ('use_secure_store', true, 'Use SecureStore for token storage'),
  ('optimistic_auth', true, 'Enable optimistic authentication loading'),
  ('offline_mode', true, 'Enable 24h offline grace period'),
  ('lazy_service_init', true, 'Lazy initialize Agora/push services');
```

**Usage in TokenStorage**:
```typescript
import FeatureFlags from './FeatureFlags';

const saveToken = async (token: string) => {
  const useSecureStore = await FeatureFlags.isEnabled('use_secure_store');

  if (useSecureStore) {
    try {
      await saveTokenSecurely(TOKEN_KEY, token);
    } catch (error) {
      // Fallback to AsyncStorage
      await AsyncStorage.setItem(TOKEN_KEY, token);
    }
  } else {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
};
```

---

## Implementation Checklist

### Phase 1: Security
- [x] Add expo-secure-store dependency (NetInfo already installed)
- [x] Create Supabase app_config table with feature flags
- [x] Refactor TokenStorage.ts:
  - [x] Add SecureStore wrapper with chunking
  - [x] Implement auto-migration from AsyncStorage
  - [x] Add fallback logic for SecureStore failures
  - [x] Add try-catch with corruption handling
- [x] Create SecureTokenStorage native module (iOS + Android)
- [x] Fix hardcoded user ID in intercomCallService.ts
- [x] Create strict TypeScript types (auth.types.ts)

### Phase 2: Performance
- [x] Update useAuth.tsx:
  - [x] Implement optimistic loading (load cache immediately)
  - [x] Background session validation
  - [x] Lazy on-demand token refresh
- [x] Remove artificial delays:
  - [x] Delete 2.5s delay in app/index.tsx
  - [x] Delete 100ms delay in app/_layout.tsx
- [x] Remove heartbeat system from useAuth.tsx
- [x] Lazy service initialization:
  - [x] Move push token registration after auth
  - [x] Move Agora init to morador/_layout.tsx
- [x] Update profile caching strategy (only login + manual refresh)

### Phase 3: Offline Support
- [x] Create NetworkMonitor.ts with NetInfo
- [x] Add exponential backoff retry logic
- [x] Implement 24h offline grace period:
  - [x] Local JWT validation
  - [x] Track last auth timestamp
- [x] Add 24h inactivity timeout (AppState-based)
- [x] Implement soft logout / read-only mode:
  - [x] Create ReadOnlyGuard component
  - [x] Allow viewing cached data
  - [x] Block mutations
- [x] Create OfflineQueue.ts for notifications
- [x] Add deep link queuing

### Phase 4: Analytics
- [x] Create AnalyticsTracker.ts
- [x] Add performance tracking:
  - [x] auth_startup_complete (TTI)
  - [x] Track all critical auth paths
- [x] Create FeatureFlags.ts service
- [x] Set up Supabase app_config table
- [x] Integrate feature flags into TokenStorage

---

## Files to Create

1. `apps/expo/types/auth.types.ts` - Strict TypeScript types
2. `apps/expo/services/FeatureFlags.ts` - Feature flag service
3. `apps/expo/services/NetworkMonitor.ts` - Network state & retry logic
4. `apps/expo/services/AnalyticsTracker.ts` - Performance metrics
5. `apps/expo/services/OfflineQueue.ts` - Offline notification queue
6. `apps/expo/modules/SecureTokenStorage/ios/SecureTokenStorage.swift` - iOS native module
7. `apps/expo/modules/SecureTokenStorage/android/SecureTokenStorage.kt` - Android native module

## Files to Modify

1. `apps/expo/package.json` - Add dependencies
2. `apps/expo/app.json` - Add expo-secure-store plugin
3. `apps/expo/services/TokenStorage.ts` - SecureStore migration
4. `apps/expo/hooks/useAuth.tsx` - Optimistic loading, offline support
5. `apps/expo/app/index.tsx` - Remove delay
6. `apps/expo/app/_layout.tsx` - Remove delay, lazy push tokens, deep link queue
7. `apps/expo/app/morador/_layout.tsx` - Lazy Agora init
8. `apps/expo/services/intercomCallService.ts` - Fix hardcoded user ID

---

## Testing Plan

**Manual testing only** (as per requirements)

### Test Scenarios

1. **Cold Start Performance**
   - Kill app completely
   - Launch and measure TTI (should be <2s)
   - Verify UI renders with cached user immediately
   - Confirm background validation completes

2. **Warm Start Performance**
   - Background app
   - Return to foreground
   - Should be instant (<500ms)

3. **SecureStore Migration**
   - Clean install (no existing tokens)
   - Login → verify token in SecureStore
   - Upgrade from old version → verify auto-migration
   - Simulate SecureStore failure → verify AsyncStorage fallback

4. **Offline Mode**
   - Login with network
   - Disable network (airplane mode)
   - Close and reopen app
   - Verify user still logged in (offline grace period)
   - Verify read-only mode after 24h
   - Re-enable network → verify reconnection

5. **Token Refresh**
   - Login and wait until token near expiry
   - Make API call
   - Verify auto-refresh happens
   - Confirm no user interruption

6. **Inactivity Timeout**
   - Login and leave app in background for 24h
   - Return to foreground
   - Verify auto-logout

7. **Foreground Services**
   - Login as morador
   - Receive intercom call
   - Verify call works (token accessible to native service)

8. **Corrupted Cache**
   - Manually corrupt user data in AsyncStorage
   - Open app
   - Verify graceful fallback to re-login

9. **Feature Flags**
   - Toggle use_secure_store flag in Supabase
   - Verify app respects flag change
   - Test rollback scenario

---

## Rollback Strategy

**Feature flag-based rollback**:

1. **Immediate rollback** (if critical issues):
   ```sql
   UPDATE app_config
   SET enabled = false
   WHERE feature_key = 'use_secure_store';
   ```
   - Apps will fall back to AsyncStorage on next flag fetch (5 min cache)

2. **Gradual rollout**:
   - Start with internal testers
   - Monitor metrics for 24h
   - Enable for 10% users
   - Monitor for 48h
   - Full rollout if stable

3. **Emergency revert**:
   - Push hotfix with flag check removed
   - Force AsyncStorage for all users
   - Users may need to re-login (acceptable)

---

## Success Metrics

### Performance
- **Cold start**: 4-16s → **<2s** ✅
- **Warm start**: 4-7s → **<500ms** ✅
- **Auth TTI**: Measure and baseline

### Security
- **Token storage**: Unencrypted → **Hardware-encrypted** ✅
- **Zero token leaks** in logs/errors ✅

### Reliability
- **Offline access**: 0% → **100% (24h grace)** ✅
- **Token refresh**: Transparent, zero user impact ✅
- **Migration success rate**: >99% ✅

### User Experience
- **No loading spinners** on warm starts ✅
- **Read-only mode** functional for cached data ✅
- **Zero forced logouts** within grace period ✅

---

## Decision Log

All decisions captured via Q&A:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Migration strategy | Auto-migrate on startup | Transparent to users |
| SecureStore fallback | AsyncStorage | Graceful degradation for old devices |
| Foreground service tokens | Native module bridge | Most secure for intercom calls |
| Inactivity timeout | 24h (AppState-based) | Balance security/UX |
| Token refresh | Lazy on-demand (10min buffer) | Simpler, works with Supabase auto-refresh |
| Multi-device sessions | Allow multiple | User convenience |
| Offline error UX | Soft logout with cache | View cached data, re-login for actions |
| Analytics | Comprehensive (auth_startup_complete) | Track TTI improvements |
| Heartbeat | Remove entirely | Unnecessary overhead |
| Profile re-fetch | Only on login + manual | Cache until explicit refresh |
| Testing | Manual only | Fast iteration |
| Logging | Verbose (keep all) | Debugging priority |
| Network retries | Exponential backoff (1s, 2s, 4s) | Handle transient failures |
| Cache invalidation | Only on logout | Maximum performance |
| Rollback | Feature flag (Supabase) | Remote kill switch |
| Agora init | On morador layout mount | Balance performance/readiness |
| Push tokens | After first auth success | Off critical path |
| Offline notifications | Queue in AsyncStorage | Process on reconnect |
| Migration UI | Silent background | No user interruption |
| Concurrency | Keep ref-based locks | Existing pattern works |
| Corrupted data | Try-catch, force re-login | Safe recovery |
| Network detection | @react-native-community/netinfo | Standard library |
| Activity tracking | AppState 'active' transitions | Simple, reliable |
| Read-only access | Notifications, profile, call history | Useful offline UX |
| Native module name | SecureTokenStorage | Descriptive, clear |
| Analytics events | auth_startup_complete (TTI) | Critical metric |
| Deep links | Queue and process after auth | Safe handling |
| Session preservation | Persist through updates | Standard behavior |
| Hardcoded user bug | Fix (use real ID) | Part of refactor |
| Token >2KB | Split across keys | Handle edge case |
| Platforms | iOS + Android (skip web) | Native module scope |
| Performance baseline | Just log new timings | Forward-looking |

---

## Estimated Timeline

| Phase | Tasks | Time |
|-------|-------|------|
| Phase 1 | Security (SecureStore migration) | 4-5h |
| Phase 2 | Performance (optimistic loading) | 4-5h |
| Phase 3 | Offline support (grace period) | 3-4h |
| Phase 4 | Analytics & monitoring | 2h |
| **Total** | | **13-16h** |

---

## Next Steps

1. **Review this plan** - Confirm all decisions align with product goals
2. **Prepare environment** - Ensure Supabase access, test devices ready
3. **Create feature branch** - `john/auth-optimization` (per user preference)
4. **Execute Phase 1** - Security first (critical)
5. **Test migration** - Verify SecureStore working on both platforms
6. **Execute Phase 2** - Performance improvements
7. **Measure impact** - Compare before/after TTI
8. **Execute Phase 3** - Offline support
9. **Test offline flows** - Airplane mode, grace period, reconnect
10. **Execute Phase 4** - Analytics integration
11. **QA pass** - Run through all test scenarios
12. **Gradual rollout** - Feature flag-controlled deployment
13. **Monitor metrics** - Watch for issues, rollback if needed
14. **Full deployment** - Enable for all users after 48h stable

---

**End of Plan**
