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

## Gaps and Risks

- **Hardcoded secrets/IDs in client**
  - `apps/expo/components/AgoraCallComponent.tsx` hardcodes Agora App ID.
- **Inconsistent API URL resolution**
  - `useAgora.ts` Android default uses a hardcoded ngrok URL. Should prefer `10.0.2.2` for emulator or a single env var.
- **Duplicate call components**
  - Legacy components duplicate call logic outside `useAgora()`.
- **Token API not authenticated/authorized**
  - Anyone can mint tokens with `channelName`/`uid`. No check that `uid` is part of the call; no auth or rate limiting.
- **Env leak**
  - Client env includes `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (must not be exposed).
- **Docs mismatch**
  - `token.routes.ts` comment mentions `users`, controller expects `participants`.

# Implementation Plan (4–5 days)

## Day 1 – Mobile cleanup & configuration

- **Remove legacy components**
  - Deprecate/remove `apps/expo/components/AgoraCallComponent.tsx` and `apps/expo/components/IntercomCallModal.tsx`.
  - Ensure doorman flow uses `apps/expo/app/porteiro/components/modals/IntercomModal.tsx` + `useAgora()` only.
- **Fix configuration**
  - In `apps/expo/hooks/useAgora.ts`:
    - Replace Android fallback with `http://10.0.2.2:3001` for emulator; rely on `EXPO_PUBLIC_API_BASE_URL` when set.
    - Prefer a single API env (`EXPO_PUBLIC_API_BASE_URL`); deprecate `EXPO_PUBLIC_INTERCOM_API_URL`/`EXPO_PUBLIC_INTERFONE_API_URL`.
  - In `apps/expo/env.d.ts` and `.env.example`:
    - Remove `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
    - Ensure `EXPO_PUBLIC_AGORA_APP_ID` and `EXPO_PUBLIC_API_BASE_URL` are documented.
- **Permissions & audio**
  - Ensure microphone permission checks before joining (platform-specific guidance) and keep `setDefaultAudioRouteToSpeakerphone(true)`.

## Day 2 – Secure token flow

- **New endpoint: `POST /api/tokens/for-call`**
  - Body: `{ callId, uid, role? }`.
  - Server validates:
    - Call exists and is active (not ended/declined).
    - `uid` is a participant of the call (via `DatabaseService`).
    - Optionally constrain `role` by user type (doorman=publisher, resident=subscriber).
  - Returns: `{ appId, channelName, rtcToken, rtmToken, uid, ttlSeconds, expiresAt }`.
- **Auth**
  - Add auth middleware to protect `/api/tokens/*` (verify JWT or Supabase server-side session) and add simple rate limiting.
- **Client changes**
  - In `apps/expo/hooks/useAgora.ts`:
    - Update `answerIncomingCall()` to call `/api/tokens/for-call` using `incomingInvite.signal.callId` and current user id.
    - Consider augmenting `POST /api/calls/:callId/answer` to return the answering token bundle to reduce round-trips.
- **Restrict legacy**
  - Lock down `/api/tokens/generate` (admin/server-only) or enforce auth + limits.
  - Fix route comment to say `participants`.

## Day 3 – Reliability & UX polish

- **Token renewal**
  - Register token expiry handlers (e.g., `onTokenPrivilegeWillExpire` / `onTokenPrivilegeDidExpire` if available) to refresh tokens via `/api/tokens/for-call`.
- **RTM resilience**
  - If RTM connection drops, auto-retry login until expiry; renew token when needed.
- **Incoming call UI (resident)**
  - Add `apps/expo/components/IncomingCallModal.tsx` that reads `incomingInvite` from `useAgora()` and exposes Accept/Decline + ringtone.
  - Reuse `audioService` for ringtone.
- **Docs**
  - Document flows and error handling in this file and link from root `README.md`.

## Day 4 – Tests & hardening

- **API integration tests** (`tests/`)
  - E2E: start → answer → end; validate DB transitions via `/api/calls/:callId/status`.
  - Token security:
    - Unauthorized `/api/tokens/for-call` → 401.
    - Non-participant `uid` → 403.
    - Valid participant → 200 with token bundle.
- **Observability & limits**
  - Add request ID in logs, basic rate limiting on `/api/tokens/*`.

# Detailed changes

- **Client**
  - `apps/expo/hooks/useAgora.ts`
    - Replace Android fallback URL; prefer `EXPO_PUBLIC_API_BASE_URL`.
    - Update `answerIncomingCall()` to use `/api/tokens/for-call`.
    - Add token expiry handlers to renew tokens.
  - Remove legacy components:
    - `apps/expo/components/AgoraCallComponent.tsx`
    - `apps/expo/components/IntercomCallModal.tsx`
  - Add resident UI:
    - `apps/expo/components/IncomingCallModal.tsx` using `useAgora()`.
  - Env fixes:
    - Update `apps/expo/env.d.ts` and `.env.example` to remove `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`; document `EXPO_PUBLIC_AGORA_APP_ID` and `EXPO_PUBLIC_API_BASE_URL`.

- **Server**
  - `apps/interfone-api/src/routes/token.routes.ts`
    - Add `POST /api/tokens/for-call` with auth middleware.
    - Fix comment for `generate-multiple` to `participants`.
  - `apps/interfone-api/src/controllers/token.controller.ts`
    - Add `forCall` controller: validate call + membership via `DatabaseService` and call `agoraService.generateTokenPair()`.
  - Optional: rate limiting middleware; structured logging (request id) in `src/server.ts`.

# Acceptance criteria

- **Security**
  - Tokens minted only for active calls and valid participants.
  - No hardcoded Agora credentials in client.
- **Consistency**
  - All call flows use `useAgora()`; legacy components removed.
  - Unified API URL strategy; Android emulator handled via `10.0.2.2`.
- **Reliability**
  - Token expiry handled; RTM reconnection logic in place.
  - Resident incoming-call UI with Accept/Decline + ringtone.
- **Tests**
  - E2E call lifecycle passes; token security tests pass.

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

- Do we prefer returning the answering token bundle in `POST /api/calls/:callId/answer` to reduce a round-trip?
- Which auth mechanism will protect `/api/tokens/*` (Supabase JWT verification or custom JWT from Next.js)?
- Do we need multi-resident simultaneous accept handling (first Wins) with clear UX feedback?
