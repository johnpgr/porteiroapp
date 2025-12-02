# Incoming Call Flow Fixes - Implementation Plan

## Status: ✅ COMPLETED

## Issues Fixed

1. ✅ **CallCoordinator not initialized in headless mode** - background task calls handleIncomingPush before initialize() runs, breaking CallKeep listeners
2. ✅ **No fallback when CallKeep unavailable** - users miss calls if Phone Account permission denied
3. ✅ **NotificationProvider race condition** - taps ANSWER before session exists, causing no-op
4. ✅ **Heavy work in background task** - RTM warmup + API fetch risk OS kill on low-end devices

## Implementation Tasks

- [x] 1. Initialize CallCoordinator in backgroundTask before handleIncomingPush
- [x] 2. Add fallback notification with action buttons when CallKeep fails
- [x] 3. Make ensureSessionExists public in CallCoordinator
- [x] 4. Update NotificationProvider to wait for session before answering
- [x] 5. Defer RTM warmup and fetchCallDetails to answer() method
- [x] 6. Add performance timing logs for RTM warmup and API fetch

## Files Modified

- `apps/expo/services/notification/backgroundTask.ts`
  - Added `await callCoordinator.initialize()` before handleIncomingPush
  - Added `showFallbackNotification()` for CallKeep failure fallback

- `apps/expo/services/calling/CallCoordinator.ts`
  - Made `ensureSessionExists()` public for NotificationProvider
  - Refactored `handleIncomingPushInternal()` to defer heavy work
  - Added console.time/timeEnd to warmupRTM & fetchCallDetails

- `apps/expo/providers/NotificationProvider.tsx`
  - Added `ensureSessionExists()` wait before answering from notification
  - Handles timeout gracefully

- `apps/expo/services/calling/CallSession.ts`
  - Added `initializeLightweight()` for deferred approach
  - Moved RTM warmup & API fetch to `answer()` method
  - Added console.time/timeEnd for performance monitoring

- `apps/expo/services/calling/stateMachine.ts`
  - Added `idle -> ringing` transition for lightweight flow
  - Added `ringing -> native_answered` and `ringing -> rtm_warming` for answer flow
  - Added `native_answered -> rtm_warming` for deferred warmup

## Design Decisions

- **Fallback UI**: Full-screen banner with ANSWER/DECLINE action buttons
- **Session timeout**: 10s (matches CallKeep)
- **Performance**: Defer RTM warmup + API fetch until user accepts
- **Monitoring**: Add console.time/timeEnd for latency tracking

## Expected Improvements

1. **Reliability**: CallKeep listeners work even in killed state
2. **Coverage**: Users see calls even without CallKeep permission
3. **UX**: Notification taps work reliably (no race condition)
4. **Performance**: Lighter background task, lower risk of OS kill
5. **Visibility**: Performance metrics for debugging slow devices
