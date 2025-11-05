# Fix Android CallKeep - Complete Implementation Plan

**Created:** 2025-11-05
**Status:** Planning Complete - Ready for Implementation

---

## Problem Statement

After recent testing on Android, CallKeep has the following issues:

1. **App killed/background:** Only blank notification appears, no CallKeep UI
2. **Accept button (app open):** User gets stuck on CallKeep screen, doesn't join Agora call
3. **Reject button:** Works perfectly (closes UI and rejects call)

## Root Causes

### Issue 1: No CallKeep UI When App Killed
- Background task calls `displayIncomingCall()` but CallKeep may not be fully initialized
- Android requires foreground service to prevent process termination during incoming calls
- Without foreground service, system kills app before CallKeep UI can appear

### Issue 2: Accept Button Doesn't Join Call
- Accept handler expects `incomingInvite` state to exist
- On cold start (app launched from Accept), state is empty
- Handler exits early → no Agora call joined → user stuck on screen

```typescript
// Current broken handler:
callKeepService.setOnAnswer(async ({ callUUID }) => {
  if (!incomingInvite) {
    console.warn('No incoming invite found'); // ← USER STUCK HERE
    return;
  }
  // ... answer logic that never runs
});
```

**Why Reject works:** Reject just calls `callKeepService.rejectCall()` which closes UI regardless of app state.

---

## User Requirements

✅ **Initialize CallKeep eagerly** - On morador login (not when call arrives)
✅ **Foreground service** - Auto-start when displaying incoming call
✅ **Notification check** - Only enable if `notification_enabled = true`
✅ **RTM timeout** - Wait 5 seconds for RTM invite on cold start
✅ **Error handling** - Show alert if RTM times out
✅ **Permission denied** - Fallback to regular notifications
✅ **Notification text** - Show "Incoming call from [name]"
✅ **Debug tools** - Test call button, status screen, verbose logging

---

## Implementation Plan

### 1. Create Android Foreground Service Module

**New File:** `apps/expo/services/AndroidForegroundService.ts`

**Purpose:** Start foreground service only during incoming calls (not 24/7)

```typescript
/**
 * Android Foreground Service for CallKeep
 * Starts when call is ringing, stops when call ends
 * Required to prevent Android from killing app during incoming calls
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

class AndroidForegroundService {
  private isRunning = false;
  private currentNotificationId: string | null = null;

  /**
   * Start foreground service with notification
   * Call this BEFORE displayIncomingCall()
   */
  async start(callerName: string, apartmentNumber: string): Promise<void> {
    if (Platform.OS !== 'android') {
      console.log('[ForegroundService] iOS doesn\'t need foreground service');
      return;
    }

    if (this.isRunning) {
      console.log('[ForegroundService] Already running');
      return;
    }

    try {
      // Schedule persistent notification for foreground service
      this.currentNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Incoming call from ${callerName}`,
          body: apartmentNumber ? `Apt ${apartmentNumber}` : 'Intercom Call',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: 'call',
          sticky: true, // Persistent
        },
        trigger: null,
      });

      this.isRunning = true;
      console.log('[ForegroundService] ✅ Started with notification:', this.currentNotificationId);
    } catch (error) {
      console.error('[ForegroundService] ❌ Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop foreground service
   * Call this when call ends
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      if (this.currentNotificationId) {
        await Notifications.dismissNotificationAsync(this.currentNotificationId);
        this.currentNotificationId = null;
      }

      this.isRunning = false;
      console.log('[ForegroundService] ✅ Stopped');
    } catch (error) {
      console.error('[ForegroundService] ❌ Failed to stop:', error);
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

export const foregroundService = new AndroidForegroundService();
```

---

### 2. Update CallKeepService to Auto-Start Foreground Service

**File:** `apps/expo/services/CallKeepService.ts`

#### 2.1 Modify `displayIncomingCall()` (line ~256)

**Add foreground service startup BEFORE calling RNCallKeep:**

```typescript
async displayIncomingCall(
  callUUID: string,
  callerName: string,
  handle: string = 'Interfone',
  hasVideo: boolean = false
): Promise<void> {
  console.log('[CallKeep] 📞 displayIncomingCall() called');
  console.log('[CallKeep] - callUUID:', callUUID);
  console.log('[CallKeep] - callerName:', callerName);
  console.log('[CallKeep] - handle:', handle);
  console.log('[CallKeep] - Platform:', Platform.OS);

  try {
    if (!this.isInitialized) {
      console.log('[CallKeep] Not initialized, calling initialize()...');
      await this.initialize();
    }

    // Check permissions
    const hasPermissions = await this.checkPermissions();
    if (!hasPermissions) {
      console.error('[CallKeep] ❌ Permissions not granted - cannot display call');
      throw new Error('CallKeep permissions required');
    }

    // ✅ ANDROID: Start foreground service BEFORE displaying call
    if (Platform.OS === 'android') {
      console.log('[CallKeep] 🚀 Starting Android foreground service...');
      const { foregroundService } = await import('./AndroidForegroundService');
      await foregroundService.start(callerName, handle);
      console.log('[CallKeep] ✅ Foreground service started');
    }

    if (!this.isNativeEnvironment) {
      console.log('[CallKeep] 📞 [Web] Simulating incoming call:', callUUID, '-', callerName);
      return;
    }

    this.currentCallUUID = callUUID;
    console.log('[CallKeep] Current call UUID set to:', this.currentCallUUID);

    console.log('[CallKeep] 📱 Calling RNCallKeep.displayIncomingCall()...');
    await RNCallKeep.displayIncomingCall(callUUID, handle, callerName, 'generic', hasVideo);
    console.log('[CallKeep] ✅ RNCallKeep.displayIncomingCall() completed');
    console.log('[CallKeep] 📞 Native UI should now be showing');

  } catch (error) {
    console.error('[CallKeep] ❌ displayIncomingCall() failed:', error);

    // Stop foreground service on error
    if (Platform.OS === 'android') {
      const { foregroundService } = await import('./AndroidForegroundService');
      await foregroundService.stop();
    }

    throw error;
  }
}
```

#### 2.2 Stop Foreground Service in `endCall()` (line ~338)

```typescript
async endCall(callUUID?: string): Promise<void> {
  try {
    const uuid = callUUID || this.currentCallUUID;
    if (!uuid) {
      console.warn('Nenhuma chamada ativa para encerrar');
      return;
    }

    if (!this.isNativeEnvironment) {
      console.log(`📞 [Web] Simulando encerramento de chamada: ${uuid}`);
      if (uuid === this.currentCallUUID) {
        this.currentCallUUID = null;
      }
      return;
    }

    await RNCallKeep.endCall(uuid);

    if (uuid === this.currentCallUUID) {
      this.currentCallUUID = null;
    }

    // ✅ ANDROID: Stop foreground service when call ends
    if (Platform.OS === 'android') {
      console.log('[CallKeep] 🛑 Stopping Android foreground service...');
      const { foregroundService } = await import('./AndroidForegroundService');
      await foregroundService.stop();
      console.log('[CallKeep] ✅ Foreground service stopped');
    }

    console.log(`📞 Chamada encerrada: ${uuid}`);
  } catch (error) {
    console.error('❌ Erro ao encerrar chamada:', error);
    throw error;
  }
}
```

#### 2.3 Stop Foreground Service in `reportEndCall()` (line ~434)

```typescript
async reportEndCall(callUUID?: string, reason: number = 2): Promise<void> {
  try {
    const uuid = callUUID || this.currentCallUUID;
    if (!uuid) {
      console.warn('Nenhuma chamada para reportar como terminada');
      return;
    }

    await RNCallKeep.reportEndCallWithUUID(uuid, reason);

    if (uuid === this.currentCallUUID) {
      this.currentCallUUID = null;
    }

    // ✅ ANDROID: Stop foreground service
    if (Platform.OS === 'android') {
      const { foregroundService } = await import('./AndroidForegroundService');
      await foregroundService.stop();
    }

    console.log(`📞 Chamada reportada como terminada: ${uuid} (razão: ${reason})`);
  } catch (error) {
    console.error('❌ Erro ao reportar fim da chamada:', error);
  }
}
```

#### 2.4 Add Verbose Logging

**Add at top of CallKeepService class:**

```typescript
class CallKeepService {
  private isInitialized = false;
  private currentCallUUID: string | null = null;
  private isNativeEnvironment = Platform.OS === 'ios' || Platform.OS === 'android';
  private lastOptions: CallKeepOptions | null = null;
  private externalOnAnswer: ((args: { callUUID: string }) => void | Promise<void>) | null = null;
  private externalOnEnd: ((args: { callUUID: string }) => void | Promise<void>) | null = null;
  private externalOnToggleMute: ((args: { muted: boolean; callUUID: string }) => void | Promise<void>) | null = null;

  // ✅ ADD: Verbose logging
  private verboseLogging = __DEV__; // Enable in dev mode

  private vlog(...args: any[]) {
    if (this.verboseLogging) {
      console.log('[CallKeep][VERBOSE]', ...args);
    }
  }

  enableVerboseLogging(enabled: boolean) {
    this.verboseLogging = enabled;
    console.log('[CallKeep] Verbose logging:', enabled ? 'ENABLED' : 'DISABLED');
  }

  // ... rest of class
}
```

**Add verbose logs in critical methods:**

```typescript
async initialize(): Promise<void> {
  this.vlog('📋 Initialize called');
  this.vlog('  - Platform:', Platform.OS);
  this.vlog('  - isInitialized:', this.isInitialized);
  this.vlog('  - isNativeEnvironment:', this.isNativeEnvironment);
  // ... existing code
}

async displayIncomingCall(...) {
  this.vlog('📋 Display incoming call parameters:', { callUUID, callerName, handle, hasVideo });
  this.vlog('🔍 Pre-flight checks...');
  this.vlog('  - isInitialized:', this.isInitialized);
  this.vlog('  - isNativeEnvironment:', this.isNativeEnvironment);
  this.vlog('  - Platform:', Platform.OS);
  // ... existing code
}
```

---

### 3. Initialize CallKeep on Morador Login

**File:** `apps/expo/app/morador/_layout.tsx`

**Add after existing RTM initialization (around line 136):**

```typescript
// ✅ Initialize CallKeep eagerly for morador users
useEffect(() => {
  if (!user?.id) return;

  const initializeCallKeep = async () => {
    try {
      console.log('[MoradorLayout] 🚀 Initializing CallKeep...');

      // Check if user has notifications enabled
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_enabled')
        .eq('user_id', user.id)
        .single();

      if (!profile?.notification_enabled) {
        console.log('[MoradorLayout] ⏭️ Skipping CallKeep - notifications disabled for user');
        return;
      }

      // Initialize CallKeep
      await callKeepService.initialize();
      console.log('[MoradorLayout] ✅ CallKeep initialized');

      // Request permissions (Android)
      const granted = await callKeepService.requestPermissions();
      if (!granted) {
        console.warn('[MoradorLayout] ⚠️ CallKeep permissions denied - falling back to notifications');
        // User can still receive calls, just via regular notifications
      } else {
        console.log('[MoradorLayout] ✅ CallKeep permissions granted');
      }

      console.log('[MoradorLayout] ✅ CallKeep ready for incoming calls');
    } catch (error) {
      console.error('[MoradorLayout] ❌ Failed to initialize CallKeep:', error);
      console.warn('[MoradorLayout] ⚠️ Falling back to regular notifications');
      // Don't throw - allow app to continue with regular notifications
    }
  };

  initializeCallKeep();
}, [user?.id]);
```

**Also need to import:**

```typescript
import { callKeepService } from '~/services/CallKeepService';
import { supabase } from '~/utils/supabase';
```

---

### 4. Fix Accept Button for Cold Start

**File:** `apps/expo/hooks/useAgora.ts` (around line 1221)

**Replace current `onAnswer` handler with:**

```typescript
callKeepService.setOnAnswer(async ({ callUUID }: { callUUID: string }) => {
  console.log('[useAgora] ========================================');
  console.log('[useAgora] 🎯 ANSWER HANDLER TRIGGERED');
  console.log('[useAgora] callUUID:', callUUID);
  console.log('[useAgora] Current user:', currentUser?.id, currentUser?.userType);
  console.log('[useAgora] Has incoming invite:', !!incomingInvite);

  // CASE 1: App already running with incoming invite
  if (incomingInvite && incomingInvite.signal.callId === callUUID) {
    console.log('[useAgora] ✅ Found matching incoming invite');
    console.log('[useAgora] Calling answerIncomingIntercomCall()...');
    await answerIncomingIntercomCall();
    console.log('[useAgora] ✅ Call answered successfully');
    return;
  }

  // CASE 2: Cold start - app launched from Accept button
  console.log('[useAgora] ⚠️ No incoming invite - this is a cold start');
  console.log('[useAgora] Checking AsyncStorage for pending call data...');

  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const pendingCallData = await AsyncStorage.getItem('@pending_intercom_call');

    if (!pendingCallData) {
      console.error('[useAgora] ❌ No pending call data in AsyncStorage');
      await callKeepService.reportEndCall(callUUID, 1); // reason: failed
      Alert.alert('Call Failed', 'Could not retrieve call information. Please try again.');
      return;
    }

    const callData = JSON.parse(pendingCallData);
    console.log('[useAgora] 📋 Found pending call:', callData);

    // Wait for RTM to connect and deliver invite (5 second timeout)
    console.log('[useAgora] ⏳ Waiting for RTM invite (5s timeout)...');

    const startTime = Date.now();
    const maxWaitTime = 5000; // 5 seconds

    const waitForInvite = new Promise<boolean>((resolve) => {
      const checkInterval = setInterval(() => {
        // Check if invite arrived
        if (incomingInvite?.signal?.callId === callUUID) {
          clearInterval(checkInterval);
          console.log('[useAgora] ✅ RTM invite received!');
          resolve(true);
          return;
        }

        // Check timeout
        if (Date.now() - startTime >= maxWaitTime) {
          clearInterval(checkInterval);
          console.error('[useAgora] ❌ Timeout waiting for RTM invite');
          resolve(false);
        }
      }, 200); // Check every 200ms
    });

    const success = await waitForInvite();

    if (success) {
      console.log('[useAgora] 🎉 RTM invite arrived, answering call...');
      await answerIncomingIntercomCall();
      console.log('[useAgora] ✅ Call answered successfully');
    } else {
      // Timeout - close CallKeep UI and show error
      console.error('[useAgora] ❌ Failed to receive RTM invite in time');
      await callKeepService.reportEndCall(callUUID, 1); // reason: failed

      Alert.alert(
        'Connection Failed',
        'Could not connect to the call. The call may have ended or there may be a network issue.',
        [{ text: 'OK' }]
      );
    }

  } catch (error) {
    console.error('[useAgora] ❌ Error in cold start answer handler:', error);
    await callKeepService.reportEndCall(callUUID, 1); // reason: failed

    Alert.alert(
      'Call Error',
      'An error occurred while connecting to the call. Please try again.',
      [{ text: 'OK' }]
    );
  }

  console.log('[useAgora] ========================================');
});
```

**Also add Alert import at top:**

```typescript
import { Alert } from 'react-native';
```

---

### 5. Remove Old CallKeep Initialization

**File:** `apps/expo/hooks/useAgora.ts` (around line 1215)

**Remove this block:**

```typescript
// Wire CallKeep events to Agora call actions
useEffect(() => {
  // Initialize CallKeep for residents
  if (currentUser?.userType === 'morador') {
    callKeepService.initialize().catch((error: unknown) => {  // ← DELETE THIS
      console.error('[useAgora] Failed to initialize CallKeep:', error);
    });
  }

  // ... keep the rest (setOnAnswer, setOnEnd handlers)
```

**Keep only the event handler registration:**

```typescript
useEffect(() => {
  // Register CallKeep answer handler
  callKeepService.setOnAnswer(async ({ callUUID }) => {
    // ... handler code (updated above)
  });

  // Register CallKeep end handler
  callKeepService.setOnEnd(async ({ callUUID }) => {
    // ... existing handler
  });

  // ... rest of effect
}, [/* dependencies */]);
```

---

### 6. Add Debug Tools

#### 6.1 Test Call Button

**New File:** `apps/expo/app/morador/settings.tsx` (or add to existing)

```typescript
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { callKeepService } from '~/services/CallKeepService';
import { router } from 'expo-router';

export default function MoradorSettings() {
  const handleTestCall = async () => {
    try {
      const testCallUUID = `test-${Date.now()}`;
      await callKeepService.displayIncomingCall(
        testCallUUID,
        'Test Doorman',
        'Apt 123',
        false
      );
      console.log('✅ Test call displayed');
    } catch (error) {
      console.error('❌ Test call failed:', error);
      Alert.alert('Test Failed', String(error));
    }
  };

  const goToStatus = () => {
    router.push('/morador/callkeep-status');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Developer Tools</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CallKeep Testing</Text>
        <Button title="🧪 Test CallKeep UI" onPress={handleTestCall} />
        <View style={{ height: 10 }} />
        <Button title="📊 View Status" onPress={goToStatus} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
});
```

#### 6.2 CallKeep Status Screen

**New File:** `apps/expo/app/morador/callkeep-status.tsx`

```typescript
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Button } from 'react-native';
import { callKeepService } from '~/services/CallKeepService';
import { foregroundService } from '~/services/AndroidForegroundService';
import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';

export default function CallKeepStatus() {
  const [status, setStatus] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = async () => {
    try {
      let hasPermissions = false;
      if (Platform.OS === 'android') {
        hasPermissions = await RNCallKeep.checkPhoneAccountEnabled();
      } else {
        hasPermissions = true; // iOS doesn't need this check
      }

      const hasActiveCall = callKeepService.hasActiveCall();
      const currentUUID = callKeepService.getCurrentCallUUID();
      const foregroundRunning = foregroundService.isServiceRunning();

      setStatus({
        platform: Platform.OS,
        hasPermissions,
        hasActiveCall,
        currentUUID: currentUUID || 'None',
        foregroundRunning,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (error) {
      console.error('Error checking status:', error);
      setStatus({
        error: String(error),
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await checkStatus();
    setRefreshing(false);
  };

  const toggleVerboseLogging = () => {
    const newState = !status.verboseLogging;
    callKeepService.enableVerboseLogging(newState);
    setStatus({ ...status, verboseLogging: newState });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>CallKeep Status</Text>

      {status.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Error: {status.error}</Text>
        </View>
      ) : (
        <>
          <View style={styles.statusItem}>
            <Text style={styles.label}>Platform:</Text>
            <Text style={styles.value}>{status.platform}</Text>
          </View>

          <View style={styles.statusItem}>
            <Text style={styles.label}>Permissions Granted:</Text>
            <Text style={[styles.value, status.hasPermissions ? styles.success : styles.error]}>
              {status.hasPermissions ? '✅ YES' : '❌ NO'}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Text style={styles.label}>Active Call:</Text>
            <Text style={[styles.value, status.hasActiveCall ? styles.success : styles.normal]}>
              {status.hasActiveCall ? '📞 YES' : 'No'}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <Text style={styles.label}>Current Call UUID:</Text>
            <Text style={styles.value}>{status.currentUUID}</Text>
          </View>

          {Platform.OS === 'android' && (
            <View style={styles.statusItem}>
              <Text style={styles.label}>Foreground Service:</Text>
              <Text style={[styles.value, status.foregroundRunning ? styles.success : styles.normal]}>
                {status.foregroundRunning ? '🚀 Running' : 'Stopped'}
              </Text>
            </View>
          )}

          <View style={styles.statusItem}>
            <Text style={styles.label}>Last Updated:</Text>
            <Text style={styles.value}>{status.timestamp}</Text>
          </View>

          <View style={styles.section}>
            <Button
              title={`Verbose Logging: ${status.verboseLogging ? 'ON' : 'OFF'}`}
              onPress={toggleVerboseLogging}
            />
          </View>
        </>
      )}

      <Text style={styles.note}>Pull down to refresh</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
  },
  statusItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5
  },
  value: {
    fontSize: 18,
    fontWeight: '600'
  },
  success: {
    color: '#4caf50'
  },
  error: {
    color: '#f44336'
  },
  normal: {
    color: '#333'
  },
  note: {
    fontSize: 12,
    color: '#999',
    marginTop: 20,
    textAlign: 'center'
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 10,
    borderRadius: 8,
  },
  errorBox: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
});
```

---

### 7. Update app.json for Foreground Service

**File:** `apps/expo/app.json`

**Add to android section:**

```json
"android": {
  "permissions": [
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.VIBRATE",
    "com.google.android.c2dm.permission.RECEIVE",
    "android.permission.RECORD_AUDIO",
    "android.permission.CAMERA",
    "android.permission.MODIFY_AUDIO_SETTINGS",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.BLUETOOTH",
    "android.permission.INTERNET",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.WAKE_LOCK"
  ],
  "foregroundService": {
    "type": ["camera", "microphone", "phoneCall"]
  }
}
```

---

## Expected Behavior After Implementation

### Background/Killed App:
1. ✅ High-priority push arrives
2. ✅ Background task runs
3. ✅ Foreground service starts automatically with notification "Incoming call from [Doorman] - Apt 123"
4. ✅ CallKeep UI appears with Accept/Reject buttons
5. ✅ Device rings with native ringtone

### Accept Button (Cold Start):
1. ✅ User taps Accept → App launches
2. ✅ Handler waits up to 5 seconds for RTM invite
3. ✅ Once RTM delivers invite → joins Agora call immediately
4. ✅ If timeout → shows alert "Connection Failed...", closes CallKeep UI
5. ✅ Foreground service stops when call ends

### Accept Button (App Open):
1. ✅ User taps Accept
2. ✅ Immediately joins Agora call (no waiting, instant)
3. ✅ Works as expected

### Reject Button:
1. ✅ Already works perfectly - no changes needed
2. ✅ Foreground service stops automatically

### Permission Denied:
1. ✅ User denies CallKeep permissions during setup
2. ✅ App continues working normally
3. ✅ Falls back to regular push notifications
4. ✅ No CallKeep UI, but user still gets notified

### Debug Tools:
1. ✅ Test call button in `/morador/settings`
2. ✅ Status screen at `/morador/callkeep-status` shows:
   - Platform (Android/iOS)
   - Permissions status
   - Active call status
   - Current call UUID
   - Foreground service status (Android only)
   - Verbose logging toggle
3. ✅ Verbose logging available in dev mode

---

## Files Summary

### Create (3 files)
1. `apps/expo/services/AndroidForegroundService.ts` - Foreground service manager
2. `apps/expo/app/morador/callkeep-status.tsx` - Status debugging screen
3. `apps/expo/app/morador/settings.tsx` - Settings with test button (if doesn't exist)

### Modify (5 files)
4. `apps/expo/services/CallKeepService.ts` - Auto-start foreground service, stop on end, verbose logging
5. `apps/expo/app/morador/_layout.tsx` - Initialize CallKeep on login
6. `apps/expo/hooks/useAgora.ts` - Fix accept handler for cold start, remove old init
7. `apps/expo/app.json` - Add foreground service permissions
8. `apps/expo/services/backgroundNotificationTask.ts` - (Optional) Minor logging improvements

---

## Testing Checklist

### Initial Setup:
- [ ] Uninstall app completely from Android device
- [ ] Reinstall and login as morador user
- [ ] Verify CallKeep permission dialog appears
- [ ] Grant all permissions

### Basic Call Flow (App Open):
- [ ] With app open in foreground
- [ ] Have porteiro initiate call
- [ ] Verify CallKeep UI appears immediately
- [ ] Verify notification shows "Incoming call from [name]"
- [ ] Tap Accept
- [ ] Verify call connects instantly (no delay)
- [ ] Verify can hear/speak
- [ ] End call from either side

### Cold Start (App Killed):
- [ ] Kill app completely (swipe away from recent apps)
- [ ] Have porteiro initiate call
- [ ] Verify CallKeep UI appears (not blank notification)
- [ ] Verify device rings with native ringtone
- [ ] Verify notification shows "Incoming call from [name]"
- [ ] Tap Accept
- [ ] Verify CallKeep screen stays visible (not stuck)
- [ ] Wait up to 5 seconds
- [ ] Verify call connects successfully
- [ ] Verify can hear/speak
- [ ] End call

### Reject Button:
- [ ] Kill app completely
- [ ] Have porteiro initiate call
- [ ] Tap Reject
- [ ] Verify CallKeep UI closes immediately
- [ ] Verify call is rejected on porteiro side
- [ ] Verify foreground service stops

### Timeout Scenario:
- [ ] Disconnect device from internet
- [ ] Kill app completely
- [ ] Have porteiro initiate call
- [ ] Tap Accept
- [ ] Verify timeout after 5 seconds
- [ ] Verify error alert shows "Connection Failed..."
- [ ] Verify CallKeep UI closes

### Permission Denied:
- [ ] Uninstall app
- [ ] Reinstall and login
- [ ] Deny CallKeep permissions
- [ ] Verify app continues working
- [ ] Have porteiro initiate call
- [ ] Verify regular notification appears (not CallKeep UI)
- [ ] Verify no crash

### Notifications Disabled:
- [ ] Set `notification_enabled = false` in database for user
- [ ] Login as that user
- [ ] Verify CallKeep is NOT initialized
- [ ] Have porteiro initiate call
- [ ] Verify no notification/CallKeep (expected behavior)

### Debug Tools:
- [ ] Go to `/morador/settings`
- [ ] Tap "🧪 Test CallKeep UI"
- [ ] Verify test call appears
- [ ] Tap "📊 View Status"
- [ ] Verify status screen shows correct info
- [ ] Toggle verbose logging
- [ ] Check logs for verbose output
- [ ] Test with app in different states (open, background, killed)

---

## Known Limitations

1. **5 second timeout** - If RTM takes longer than 5 seconds to connect, call will fail
   - **Mitigation:** Can increase timeout if needed, but longer wait = worse UX

2. **Android 12+ restrictions** - Foreground service requires notification to be visible
   - **Mitigation:** Using "Incoming call from [name]" notification which is appropriate

3. **Permission denial** - If user denies CallKeep permissions, calls only work via notifications
   - **Mitigation:** Graceful fallback to regular notifications

4. **Battery usage** - Foreground service only runs during calls, minimal impact
   - **Mitigation:** Service automatically stops when call ends

---

## Rollback Plan

If critical issues arise:

1. **Revert foreground service changes:**
   - Remove AndroidForegroundService.ts
   - Remove foreground service calls from CallKeepService.ts
   - Revert app.json permissions

2. **Keep accept handler improvements:**
   - Cold start fix is valuable even without foreground service
   - No negative side effects

3. **Keep debug tools:**
   - Helpful for diagnosing issues
   - No impact on production behavior

---

## Future Enhancements

1. **Smarter timeout:** Dynamically adjust based on network speed
2. **Retry mechanism:** Auto-retry connection if first attempt fails
3. **User settings:** Let user configure timeout duration
4. **Analytics:** Track call success/failure rates
5. **Call quality metrics:** Monitor RTM connection time, call duration

---

**Implementation Ready:** 2025-11-05
**Status:** ✅ Plan Complete - Ready to Execute
