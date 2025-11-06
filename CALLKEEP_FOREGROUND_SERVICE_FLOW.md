# CallKeep Foreground Service Initialization Flow

## Overview
This document explains how the `intercom_call_keep` notification channel and foreground service are initialized for CallKeep on Android.

---

## The Complete Flow

### **Step 1: Notification Channels Created (App Startup)**

**Location:** `apps/expo/services/notificationHandler.ts`

**When:** During app initialization (before CallKeep setup)

```typescript
// Called in apps/expo/app/_layout.tsx at module level
await initializeNotificationHandler();
```

This creates all notification channels:

```typescript
await Notifications.setNotificationChannelAsync('intercom_call_keep', {
  name: 'Chamadas Ativas (CallKeep)',
  importance: Notifications.AndroidImportance.MAX,
  sound: 'telephone_toque_interfone.mp3',
  enableVibrate: true,
  enableLights: true,
  showBadge: true,
  description: 'Canal para gerenciar chamadas de interfone ativas',
});
```

**Critical:** This MUST happen before CallKeep initializes. If CallKeep tries to use a channel that doesn't exist, Android silently fails.

---

### **Step 2: CallKeep Configured with Channel ID**

**Location:** `apps/expo/services/CallKeepService.ts`

**When:** When user logs in as morador (resident)

```typescript
const options: CallKeepOptions = {
  android: {
    // ... other options
    foregroundService: {
      channelId: 'intercom_call_keep',  // ← References the channel created in Step 1
      channelName: 'Intercom Calls',
      notificationTitle: 'Intercom call in progress',
      notificationIcon: 'logo'
    }
  }
};

await RNCallKeep.setup(options);
```

**What happens:**
- The configuration is passed to the native `react-native-callkeep` Android module
- The native module stores this configuration for later use

---

### **Step 3: Foreground Service Started (Incoming Call)**

**Location:** `apps/expo/services/CallKeepService.ts` → `displayIncomingCall()`

**When:** An incoming intercom call arrives

```typescript
await callKeepService.displayIncomingCall(
  callUUID,
  callerName,
  handle,
  hasVideo
);
```

**What happens internally in native CallKeep:**

1. **Before showing CallKeep UI** → Native module starts a foreground service
2. **Creates notification** using the `intercom_call_keep` channel:
   ```
   Title: "Intercom call in progress" (from config)
   Channel: intercom_call_keep (from config)
   Icon: logo (from config)
   ```
3. **Displays full-screen CallKeep UI** (native Android call screen)
4. **Keeps service alive** during the entire call

---

### **Step 4: Foreground Service Stopped (Call Ends)**

**Location:** `apps/expo/services/CallKeepService.ts` → `endCall()`

**When:** User answers, declines, or call times out

```typescript
await callKeepService.endCall(callUUID);
```

**What happens:**
- Native CallKeep module stops the foreground service
- Notification is automatically dismissed
- All resources cleaned up

---

## Naming Convention: snake_case

All Android notification channels use **snake_case** naming:

| Channel ID | Purpose | Used By |
|------------|---------|---------|
| `intercom_call` | Wake-up push notifications | Backend push service |
| `intercom_call_keep` | CallKeep foreground service | react-native-callkeep native module |
| `call` | AndroidForegroundService | Our custom foreground service wrapper |
| `visitor` | Visitor notifications | notificationService.ts |
| `delivery` | Delivery notifications | notificationService.ts |
| `emergency` | Emergency notifications | notificationService.ts |
| `default` | General notifications | Fallback channel |

---

## Why Two Foreground Services?

You might notice we have **two** foreground service mechanisms:

### 1. **CallKeep's Built-in Foreground Service** (`intercom_call_keep`)
- **Purpose:** Required by CallKeep to display the native Android call UI
- **Managed by:** react-native-callkeep native module (automatic)
- **When:** Started automatically when `displayIncomingCall()` is called
- **Notification:** "Intercom call in progress" (visible in notification tray)

### 2. **AndroidForegroundService** (`call` channel)
- **Purpose:** Additional safety layer to keep app alive
- **Managed by:** Our custom service (manual control)
- **When:** Started explicitly via `foregroundService.start()`
- **Notification:** "Incoming call from {callerName}" (visible in notification tray)

**Why both?**
- CallKeep's service is tied to the native call UI lifecycle
- AndroidForegroundService provides extra insurance that the app stays alive
- Two layers of protection against Android killing the app during calls

---

## Initialization Order (Critical)

```
1. App starts
   ↓
2. initializeNotificationHandler() executes
   - Creates ALL notification channels (including intercom_call_keep)
   ↓
3. User logs in as morador
   ↓
4. MoradorLayout mounts
   ↓
5. callKeepService.initialize() executes
   - Passes intercom_call_keep channel ID to native module
   - Now channel exists, so CallKeep can use it
   ↓
6. Incoming call arrives
   ↓
7. displayIncomingCall() called
   - Native CallKeep module starts foreground service
   - Uses intercom_call_keep channel (which exists)
   - Full-screen UI appears ✅
```

**If channels are created AFTER CallKeep initialization:**
```
❌ CallKeep tries to use 'intercom_call_keep' channel
❌ Channel doesn't exist yet
❌ Android silently fails
❌ No UI shows, only push notification
```

---

## Native Module Internals

The `react-native-callkeep` native Android module does this:

```kotlin
// Simplified pseudo-code of what happens in the native module

fun displayIncomingCall(callUUID: String, callerName: String, ...) {
    // 1. Create foreground service notification
    val notification = NotificationCompat.Builder(context, foregroundServiceChannelId) // ← 'intercom_call_keep'
        .setContentTitle(foregroundServiceTitle) // ← "Intercom call in progress"
        .setSmallIcon(foregroundServiceIcon) // ← 'logo'
        .setOngoing(true)
        .build()
    
    // 2. Start foreground service with notification
    startForeground(NOTIFICATION_ID, notification)
    
    // 3. Show full-screen call UI
    val intent = Intent(context, CallActivity::class.java)
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    context.startActivity(intent)
}
```

**Key Points:**
- The channel ID must exist before this code runs
- If it doesn't exist, `NotificationCompat.Builder()` fails silently
- No exceptions thrown, just no UI displayed

---

## Debugging Tips

### Check if channel exists:
```bash
adb shell dumpsys notification_policy
# Look for "intercom_call_keep" in the output
```

### Check CallKeep logs:
```typescript
callKeepService.enableVerboseLogging(true);
// Then check logs for [CallKeep] messages
```

### Verify initialization order:
```
✅ [NotificationHandler] Notification channels configured
✅ [CallKeep] 🚀 initialize() called
✅ [CallKeep] ⚙️ Calling RNCallKeep.setup()...
✅ [CallKeep] ✅ RNCallKeep.setup() completed
```

If you see CallKeep setup before notification channels, the order is wrong!

---

## Summary

- **Channel created:** During app startup via `initializeNotificationHandler()`
- **Channel ID configured:** During CallKeep initialization via `RNCallKeep.setup()`
- **Foreground service started:** Automatically by native CallKeep when call arrives
- **Naming convention:** All channels use `snake_case`
- **Critical requirement:** Channels must exist BEFORE CallKeep initializes

The `intercom_call_keep` channel is the bridge between our JavaScript code and the native CallKeep Android implementation.

