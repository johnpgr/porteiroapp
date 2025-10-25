# Agora Voice Integration Plan (React Native + Express)

This document reviews the current Agora Voice (RTC/RTM) implementation across the Expo app and the Interfone API, identifies gaps, and outlines a secure, maintainable plan to complete the feature.

## References

- Core concepts: https://docs-staging.agora.io/en/voice-calling/overview/core-concepts?platform=react-native
- Quick start: https://docs-staging.agora.io/en/voice-calling/get-started/get-started-sdk?platform=react-native
- Manage media & devices: https://docs-staging.agora.io/en/voice-calling/get-started/volume-control-and-mute?platform=react-native
- Token server: https://docs-staging.agora.io/en/voice-calling/token-authentication/deploy-token-server
- Best practices (sound quality): https://docs-staging.agora.io/en/voice-calling/best-practices/best-practices-sound-quality?platform=react-native
- Best practices (app size): https://docs-staging.agora.io/en/voice-calling/best-practices/app-size-optimization?platform=react-native
- Best practices (prevent stream bombing): https://docs-staging.agora.io/en/voice-calling/best-practices/prevent-stream-bombing?platform=react-native
- API Reference (React Native 4.x): https://api-ref.agora.io/en/voice-sdk/react-native/4.x/API/rtc_api_overview.html

## App context

React Native (Expo 54) mobile app needs a voice intercom feature for condos. Doorman (porteiro) initiates a call to an apartment number; residents can accept/decline. Backend is an Express API managing call lifecycle and token issuance.

# Findings

- **Mobile Agora implementation (`apps/expo/`)**
  - **`apps/expo/hooks/useAgora.ts`**
    - Creates RTC engine via `createAgoraRtcEngine()`, sets channel profile/role, configures audio, routes audio to speaker.
    - Integrates RTM via `agora-react-native-rtm` with loginV2, connection/message listeners, and a call state machine (`apps/expo/services/calling/`).
    - Token acquisition: if `joinChannel` lacks a token, it posts to `/api/tokens/generate` for `{channelName, uid, role}`.
    - API base URL resolution mixes multiple envs and a hardcoded Android fallback `https://5302cc59505a.ngrok-free.app/` (brittle). Prefer `http://10.0.2.2:3001` for Android emulator and a single `EXPO_PUBLIC_API_BASE_URL`.
    - Uses `EXPO_PUBLIC_AGORA_APP_ID` (good).
  - **Legacy/duplicate UI**
    - `apps/expo/components/AgoraCallComponent.tsx` and `apps/expo/components/IntercomCallModal.tsx` hardcode an Agora App ID and call the API directly, bypassing `useAgora()` and duplicating logic.
    - `apps/expo/app/porteiro/components/modals/IntercomModal.tsx` is the modern flow and correctly uses `useAgora()`.
  - **Env typing/content**
    - `apps/expo/env.d.ts` and `.env.example` include `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (server secret) as a client env. This must be removed.

- **Token API and Call lifecycle (`apps/interfone-api/`)**
  - **Tokens**
    - `src/services/agora.service.ts` uses `agora-token` to create RTC (user account) and RTM tokens; TTL defaults to 300s (max 3600s). Good separation; no cert leakage.
    - `src/controllers/token.controller.ts`, `src/routes/token.routes.ts` expose:
      - `POST /api/tokens/generate` for arbitrary `{channelName, uid}`
      - `POST /api/tokens/generate-multiple` for `{channelName, participants[]}` (comment says `users` but controller expects `participants`)
      - `POST /api/tokens/validate` stub
    - Security gap: token endpoints are unauthenticated and do not validate call membership.
  - **Calls**
    - `src/controllers/call.controller.ts`, `src/routes/call.routes.ts` manage start/answer/decline/end/status/history/active.
    - `POST /api/calls/start` creates call, generates initiator tokens, returns `data.tokens.initiator` plus an RTM `INVITE` payload. Client handles signaling via RTM.
    - `POST /api/calls/:callId/answer` updates DB and returns participants; client then fetches token separately (should be bound to the call).

## Gaps and Risks (Original Assessment)

- ~~**Hardcoded secrets/IDs in client**~~ ✅ **RESOLVED**
  - ~~`apps/expo/components/AgoraCallComponent.tsx` hardcodes Agora App ID.~~ Component removed.
- ~~**Inconsistent API URL resolution**~~ ✅ **RESOLVED**
  - ~~`useAgora.ts` Android default uses a hardcoded ngrok URL.~~ Now uses `http://10.0.2.2:3001` for emulator and `EXPO_PUBLIC_API_BASE_URL`.
- ~~**Duplicate call components**~~ ✅ **RESOLVED**
  - ~~Legacy components duplicate call logic outside `useAgora()`.~~ Both legacy components removed.
- ~~**Token API not authenticated/authorized**~~ ✅ **RESOLVED**
  - ~~Anyone can mint tokens with `channelName`/`uid`.~~ All token endpoints now protected with Supabase auth middleware; `/api/tokens/for-call` validates call membership; rate limiting added (60 req/min).
- ~~**Env leak**~~ ✅ **RESOLVED**
  - ~~Client env includes `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.~~ Removed from `env.d.ts` and `.env.example`.
- ~~**Docs mismatch**~~ ✅ **RESOLVED**
  - ~~`token.routes.ts` comment mentions `users`, controller expects `participants`.~~ Fixed to `participants`.

# Implementation Plan (4–5 days)

## Day 1 – Mobile cleanup & configuration ✅ **COMPLETED**

- ✅ **Remove legacy components**
  - Removed `apps/expo/components/AgoraCallComponent.tsx` and `apps/expo/components/IntercomCallModal.tsx`.
  - Doorman flow uses `apps/expo/app/porteiro/components/modals/IntercomModal.tsx` + `useAgora()` only.
- ✅ **Fix configuration**
  - In `apps/expo/hooks/useAgora.ts`:
    - Android fallback now uses `http://10.0.2.2:3001` for emulator.
    - Unified API env to `EXPO_PUBLIC_API_BASE_URL`; deprecated legacy env vars.
  - In `apps/expo/services/intercomService.ts`:
    - Updated to use `EXPO_PUBLIC_API_BASE_URL` with same emulator fallback.
  - In `apps/expo/env.d.ts` and `.env.example`:
    - Removed `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
    - Documented `EXPO_PUBLIC_AGORA_APP_ID` and `EXPO_PUBLIC_API_BASE_URL`.
- ✅ **Permissions & audio**
  - Added microphone permission check via `agoraAudioService.requestPermissions()` before joining channels.

## Day 2 – Secure token flow ✅ **COMPLETED**

- ✅ **New endpoint: `POST /api/tokens/for-call`**
  - Implemented in `apps/interfone-api/src/controllers/token.controller.ts` → `generateTokenForCall()`.
  - Body: `{ callId, uid, role? }`.
  - Server validates:
    - Call exists and is active (not ended/declined).
    - `uid` is a participant of the call (checks `doorman_id` or `call_participants` table).
  - Returns: `{ appId, channelName, rtcToken, rtmToken, uid, rtcRole, ttlSeconds, expiresAt, issuedAt }`.
- ✅ **Auth**
  - Added Supabase auth middleware (`requireAuth`) to protect all `/api/tokens/*` endpoints.
  - Verifies Bearer token via `supabase.auth.getUser(accessToken)`.
  - Added simple in-memory rate limiter: 60 req/min per IP.
- ✅ **Client changes**
  - In `apps/expo/hooks/useAgora.ts`:
    - `answerIncomingCall()` now calls `/api/tokens/for-call` with `callId` and `uid`.
    - Added `fetchTokenForCall()` helper that attaches Supabase access token via `Authorization: Bearer` header.
    - Token renewal: added `onTokenPrivilegeWillExpire` and `onRequestToken` handlers to refresh tokens using `/api/tokens/for-call`.
- ✅ **Restrict legacy**
  - All token endpoints (`/generate`, `/generate-multiple`, `/validate`, `/for-call`) now require auth.
  - Fixed route comment to say `participants`.

## Day 3 – Reliability & UX polish ✅ **COMPLETED**

- ✅ **Token renewal**
  - Registered `onTokenPrivilegeWillExpire` and `onRequestToken` handlers in `useAgora.ts` to refresh RTC tokens via `/api/tokens/for-call`.
  - Added proactive RTM token renewal with 30-second buffer before expiry.
  - Uses refs (`activeCallRef`, `currentUserRef`, `apiBaseUrlRef`) to avoid stale closures.
- ✅ **RTM resilience**
  - Implemented auto-retry login on RTM connection drops with exponential backoff (5 retries max).
  - Base delay: 2 seconds, exponential backoff: 2^retryCount.
  - Automatic detection of disconnection via RTM connectionStateChanged listener.
- ✅ **Incoming call UI (resident)**
  - Added `apps/expo/components/IncomingCallModal.tsx` that reads `incomingInvite` from `useAgora()` and exposes Accept/Decline + ringtone.
  - Reuses `agoraAudioService` for ringtone playback.
  - Integrated into resident layout (`apps/expo/app/morador/_layout.tsx`).
  - Removed legacy custom modal and simplified notification listeners.
  - Layout now uses single `useAgora()` instance passed to IncomingCallModal via props.
- ✅ **Docs**
  - This document updated with all implementation details.
  - Linked from root `README.md`.

## Day 4 – Tests & hardening ✅ **COMPLETED**

- ✅ **API integration tests** (`tests/`)
  - Added `tests/src/token-security.test.ts` with comprehensive security tests:
    - Unauthorized requests to all protected endpoints → 401.
    - Invalid Bearer tokens → 401.
    - Malformed Authorization headers → 401.
    - Rate limiting validation (65 rapid requests) → 429.
    - Public endpoints (`/test`, `/config`) accessible without auth.
    - Placeholder tests for authenticated scenarios (call validation, participant checks).
  - Added `pnpm test:token` script to `tests/package.json`.
  - ⏳ E2E call lifecycle tests (start → answer → end) not yet implemented.
- ✅ **Observability & limits**
  - Added request-id middleware in `apps/interfone-api/src/server.ts`:
    - Generates UUID for each request or accepts client-provided `X-Request-ID`.
    - All logs include `[request-id]` prefix.
    - Error handler includes request-id in logs and responses.
    - CORS updated to allow and expose `X-Request-ID` header.
    - Redacts sensitive tokens (`rtcToken`, `rtmToken`, `password`, `token`) from logs.
  - Rate limiting: 60 req/min per IP on all `/api/tokens/*` routes.

# Detailed changes (Implementation Summary)

## ✅ Client Changes (Completed)

- **`apps/expo/hooks/useAgora.ts`**
  - Unified API base URL resolution: prefers `EXPO_PUBLIC_API_BASE_URL`, Android emulator fallback `http://10.0.2.2:3001`.
  - Added `fetchTokenForCall()` helper that calls `POST /api/tokens/for-call` with Supabase auth token.
  - Updated `answerIncomingCall()` to use tokens from `/api/calls/:callId/answer` response (with fallback to separate fetch for backward compatibility).
  - Added RTC token renewal handlers: `onTokenPrivilegeWillExpire` and `onRequestToken` to refresh RTC tokens.
  - Added RTM token renewal with proactive refresh (30-second buffer before expiry).
  - Implemented RTM auto-reconnection with exponential backoff (5 retries, base delay 2s).
  - Added microphone permission check via `agoraAudioService.requestPermissions()` before joining.
  - Added refs (`activeCallRef`, `currentUserRef`, `apiBaseUrlRef`) to avoid stale closures in event handlers.

- **`apps/expo/services/intercomService.ts`**
  - Unified API base URL to use `EXPO_PUBLIC_API_BASE_URL` with Android emulator fallback.
  - Fixed TypeScript compatibility for snake_case response fields.

- **Removed legacy components:**
  - `apps/expo/components/AgoraCallComponent.tsx` ✅
  - `apps/expo/components/IntercomCallModal.tsx` ✅

- **Added resident UI:**
  - `apps/expo/components/IncomingCallModal.tsx` using `useAgora()` with Accept/Decline + ringtone.
  - Modified to accept `agoraContext` prop to share single `useAgora()` instance.

- **`apps/expo/app/morador/_layout.tsx` (Resident Layout)**
  - Integrated IncomingCallModal with shared `useAgora()` instance.
  - Removed legacy custom modal UI and all related state management (500+ lines simplified).
  - Removed duplicate realtime subscriptions (now handled by useAgora RTM).
  - Removed polling for pending calls (now handled by useAgora RTM).
  - Simplified notification listeners to only log events (useAgora handles call state).
  - Single source of truth for call state via `useAgora()` hook.

- **Env fixes:**
  - `apps/expo/env.d.ts`: removed `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
  - `apps/expo/.env.example`: cleaned up to document only client vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_AGORA_APP_ID`, `EXPO_PUBLIC_API_BASE_URL`).

## ✅ Server Changes (Completed)

- **`apps/interfone-api/src/routes/token.routes.ts`**
  - Added `POST /api/tokens/for-call` route with `requireAuth` middleware.
  - Added Supabase auth middleware (`requireAuth`) that verifies Bearer tokens via `supabase.auth.getUser()`.
  - Added simple in-memory rate limiter: 60 req/min per IP.
  - Protected all token endpoints: `/generate`, `/generate-multiple`, `/validate`, `/for-call`.
  - Fixed comment for `generate-multiple` to say `participants`.

- **`apps/interfone-api/src/controllers/token.controller.ts`**
  - Added `generateTokenForCall()` controller:
    - Validates `callId` and `uid` parameters.
    - Fetches call from DB via `DatabaseService.getCallById()`.
    - Validates call is active (not ended/declined).
    - Validates `uid` is participant (checks `doorman_id` or `call_participants`).
    - Returns token bundle with `appId`, `channelName`, `rtcToken`, `rtmToken`, etc.

- **`apps/interfone-api/src/controllers/call.controller.ts`**
  - Updated `answerCall()` to generate and return token bundle in response:
    - Eliminates extra round-trip to `/api/tokens/for-call`.
    - Generates tokens for answering user using `agoraService.generateTokenBundle()`.
    - Returns tokens alongside call and participants data.
    - Client uses embedded tokens or falls back to separate fetch for backward compatibility.

- **`apps/interfone-api/src/server.ts`**
  - Added request-id middleware: generates UUID or accepts `X-Request-ID` header.
  - Updated all logs to include `[request-id]` prefix.
  - Error handler includes request-id in logs and responses.
  - CORS updated to allow and expose `X-Request-ID` header.
  - Redacts sensitive tokens from logs (`rtcToken`, `rtmToken`, `password`, `token`).
  - Listed `/api/tokens/for-call` in available routes.

## ✅ Tests (Completed)

- **`tests/src/token-security.test.ts`**
  - Comprehensive security tests for all token endpoints.
  - Tests unauthorized access (401), invalid tokens, rate limiting (429).
  - Added `pnpm test:token` script to `tests/package.json`.

# Acceptance criteria

- ✅ **Security**
  - Tokens minted only for active calls and valid participants via `/api/tokens/for-call`.
  - No hardcoded Agora credentials in client (legacy components removed).
  - All token endpoints protected with Supabase auth + rate limiting.
- ✅ **Consistency**
  - All call flows use `useAgora()`; legacy components removed.
  - Unified API URL strategy; Android emulator handled via `10.0.2.2:3001`.
- ✅ **Reliability**
  - ✅ RTC token expiry handled via renewal events.
  - ✅ RTM token renewal implemented with proactive refresh.
  - ✅ RTM reconnection logic with exponential backoff.
  - ✅ Resident incoming-call UI component created (`IncomingCallModal.tsx`).
  - ✅ Integrated into resident layout with single `useAgora()` instance.
- ⚠️ **Tests** (Partially met)
  - ⏳ E2E call lifecycle tests not yet implemented.
  - ✅ Token security tests pass (unauthorized, rate limiting, etc.).

# Runbook & troubleshooting

- **Ports**: API default 3000; tests expect 3001. Set `PORT=3001` in API `.env` for tests.
- **Android emulator**: Use `http://10.0.2.2:3001` to reach host API.
- **Permissions**: Ensure microphone permission is granted before joining.
- **Token TTL**: Default 300s; implement renewal for longer calls.

# Notes vs Agora best practices

- Use user accounts (you do) with `registerLocalUserAccount` + `joinChannelWithUserAccount` to match RTC token type.
- Keep tokens short-lived and renew on expiry events.
- Do not ship the Agora certificate; only App ID goes to the client.
- Tune audio scenarios per platform if needed for quality.

# Open questions

- ~~Which auth mechanism will protect `/api/tokens/*`?~~ ✅ **RESOLVED**: Using Supabase JWT verification via `supabase.auth.getUser(accessToken)`.
- ~~Do we prefer returning the answering token bundle in `POST /api/calls/:callId/answer` to reduce a round-trip?~~ ✅ **RESOLVED**: Implemented. Answer endpoint now returns tokens.
- ~~Should we implement RTM token renewal alongside RTC token renewal?~~ ✅ **RESOLVED**: Implemented with proactive refresh 30s before expiry.
- Do we need multi-resident simultaneous accept handling (first wins) with clear UX feedback?

# Remaining Work

## High Priority
- ✅ ~~Integrate `IncomingCallModal.tsx` into resident layout~~ (COMPLETED)
- ⏳ Add E2E call lifecycle tests (start → answer → end).

## Medium Priority
- ✅ ~~Implement RTM reconnection logic with auto-retry~~ (COMPLETED)
- ✅ ~~Add RTM token renewal handlers~~ (COMPLETED)
- ✅ ~~Consider returning token bundle in `/api/calls/:callId/answer` to reduce round-trips~~ (COMPLETED)

## Low Priority
- Replace in-memory rate limiter with Redis or provider-based solution for production.
- Add structured logging (JSON format) for log aggregation.
- Add metrics/monitoring hooks.
- Link this document from root `README.md`.
