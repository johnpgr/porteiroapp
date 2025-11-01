# Changelog

All notable changes to PorteiroApp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Intercom Call Recovery System** - Modal now appears when app opened during active call
  - New `checkForActiveCall()` function in useAgora hook recovers call state from push notification
  - AppState listener detects app foreground transitions and checks for pending calls
  - Auto-answer functionality for calls already in "connecting" state
  - Ringtone playback on call recovery for better UX
  - Race condition handling between RTM and API responses (first response wins)
  - Comprehensive logging for debugging call recovery flow
- **Smart Polling Fallback for RTM Connection Window**
  - 3-second polling during RTM connection (~1-2 seconds) to catch calls before RTM ready
  - New API endpoint `GET /api/calls/pending?userId=xxx` returns pending calls for user's apartment
  - Works in emulators, when notifications disabled, or as backup if RTM/push fail
  - **Automatically stops when RTM connects** - no unnecessary API spam
  - **Never restarts after first RTM connection** - RTM handles all signaling after initial connection
  - Minimal network/battery overhead (typically 0-2 API calls per app launch)

### Changed
- Enhanced push notification handlers in morador layout to extract callId and trigger recovery
- Updated RTM message callback to prevent duplicate processing during API recovery
- Improved notification listener to handle both foreground and background scenarios

### Fixed
- Intercom call modal not appearing when app opened from closed/background state via notification
- Missing call invites when RTM connection initializes after notification received
- Race conditions between RTM invite signals and API call status checks
- Initial notification not being captured when app launches from completely closed state (added `getLastNotificationResponseAsync()` check)
- API endpoint schema issues: corrected table name (`intercom_calls`), added proper DatabaseService methods, fixed SELECT query to only use existing columns
- Polling continuing after RTM connection - added `hasEverConnectedRtmRef` to track first connection and prevent restart on reconnection
- Polling interval not clearing on RTM connection - stored interval ID in ref and clear it when RTM connects
- API response parsing - fixed expo code to read `response.calls` instead of `response.data.calls`

## [Previous Versions]

_No previous changelog entries. This is the first documented release._
