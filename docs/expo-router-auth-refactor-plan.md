# Expo Router Authentication Refactor Plan

## Context
- Reference pattern: `docs/AUTHENTICATION_EXPO_ROUTER.md`
- Current implementation files:
  - `apps/expo/hooks/useAuth.tsx`
  - `apps/expo/app/_layout.tsx`
  - `apps/expo/components/ProtectedRoute.tsx`
  - All role folders in `apps/expo/app/{admin,morador,porteiro,...}`

## Goals
1. Align Expo app auth & navigation with the official **SessionProvider + Splash + Stack.Protected** pattern.
2. Ensure login routes remain reachable when logged out, while app surfaces require an authenticated (and role-appropriate) session.
3. Remove per-screen imperative guards (`ProtectedRoute`) in favor of router-level protections.
4. Preserve existing token/offline/session logic inside `useAuth`, only changing how routes consume that state.

## Proposed Architecture
### 1. Session/Splash Wiring
- Reuse `AuthProvider` as the session context.
- Add `apps/expo/splash.tsx` with a `SplashScreenController` that hides `SplashScreen` once `useAuth().initialized` is true.
- In `apps/expo/app/_layout.tsx`, wrap the stack in `<AuthProvider>` and place `<SplashScreenController />` just inside it so the splash persists until auth state loads.

### 2. Route Groups
- Create two top-level groups:
  - `(auth)` – public routes (e.g., `/admin/login`, `/morador/login`, `/porteiro/login`, shared onboarding).
  - `(app)` – all authenticated routes (existing dashboards, tabs, modals for each role).
- Keep `/index` outside any group as the anchor route (role selector + redirect logic based on `useAuth().user`).
- Move files:
  - `apps/expo/app/admin/**/*` → `apps/expo/app/(app)/admin/**/*` (except `login.tsx` which moves to `(auth)`).
  - Same for `morador`, `porteiro`, plus any other auth-required folders.

### 3. Root Stack Guards
- In `_layout.tsx` configure:
  ```tsx
  <Stack>
    <Stack.Protected guard={!!user}>
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack.Protected>
    <Stack.Protected guard={!user}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack.Protected>
    {/* keep truly public routes like index, visitante, camera, emergency, etc. */}
  </Stack>
  ```
- Use `user` from `useAuth` (cached users allowed) to determine guard state. Logged-out users still see `(auth)` stack even if offline.

### 4. Role-Level Protection
- Inside each role layout under `(app)` use `Stack.Protected` or `Redirect` to enforce role:
  ```tsx
  const { user } = useAuth();
  return (
    <Stack>
      <Stack.Protected guard={user?.user_type === 'admin'}>
        <Stack.Screen name="(tabs)" /* ... */ />
        {/* other admin screens */}
      </Stack.Protected>
    </Stack>
  );
  ```
- This replaces the need for `ProtectedRoute` wrappers in child screens.

### 5. Remove `ProtectedRoute`
- Delete `apps/expo/components/ProtectedRoute.tsx`.
- Remove imports/usages from all screens. After role-based group guards are in place, the screens can assume the correct auth context.
- Provide inline loading states where needed (rare).

### 6. Login/Redirect Flow
- Login screens (now under `(auth)`) call `signIn` and `router.replace('/')`.
- Landing page (`apps/expo/app/index.tsx`) keeps the existing logic: once `useAuth().user` exists, it routes to the correct dashboard (`/admin/(tabs)`, `/morador/(tabs)`, `/porteiro`).
- Remove `checkAndRedirectUser` helper unless still needed elsewhere—router-level guards now handle bounce logic.

### 7. Verification & Regressions
- Manual checks:
  1. Logged out → open `/morador/...` (should redirect to `/` because `(app)` guard blocks access).
  2. Logged in as each role → deep link to their stack (allowed) and to another role (blocked).
  3. Offline with cached session → ensure `!!user` is still true (read-only mode) so `(app)` stack renders, while writes still use `requireWritable`.
  4. Deep links queued before login open the right stack once user signs in.
- Automated: run `pnpm lint apps:expo` (or `pnpm lint` if feasible) and `pnpm typecheck`.

## Work Breakdown
1. **Scaffold session+splash**: new splash controller, update `_layout` to keep splash until `initialized`.
2. **Create `(auth)` and `(app)` groups**: move files, fix imports, ensure login routes remain public.
3. **Apply root stack guards**: `Stack.Protected` in `_layout`, pass relevant options.
4. **Role layouts**: wrap each role’s `_layout.tsx` with role guard, adjust `Stack.Screen` declarations.
5. **Remove `ProtectedRoute`**: delete component, strip usages, confirm screens still render.
6. **Clean up helpers**: retire `checkAndRedirectUser` if unused; ensure router redirects only happen centrally (`index.tsx` + group guards).
7. **Testing/validation**: run lint/typecheck, smoke test navigation (if possible).

Progress will be tracked by updating this document as tasks complete.

## Progress (2024-11-12)
- ✅ Added `SplashScreenController` tied to `useAuth().initialized` and wired it into `app/_layout.tsx` so the splash now obeys Expo’s recommended flow.
- ✅ Created `(app)` and `(auth)` route groups, moved `admin`, `morador`, and `porteiro` stacks under `(app)`, and relocated their `login` screens under `(auth)`.
- ✅ Updated root stack to use `<Stack.Protected>` for `(app)` vs `(auth)` plus guarded standalone screens like `/camera` and `/avisos`.
- ✅ Wrapped each role layout with role-specific `<Stack.Protected>` blocks so nested screens inherit the correct guard automatically.
- ✅ Removed the `ProtectedRoute` component and scrubbed its usage from all screens; navigation control now lives entirely in layouts.
- ✅ Removed `checkAndRedirectUser` from `useAuth` and the login screens; router-level logic now centralizes redirects.
- ✅ Ran lint (`pnpm lint:mobile`) and Expo type-checks to ensure the new route structure compiles.
- ⏳ Next: smoke-test each role’s login + deep links on device/emulator and update any onboarding docs/screenshots as needed.
