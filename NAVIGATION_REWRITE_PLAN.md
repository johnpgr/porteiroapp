# Expo App Navigation Rewrite Plan

**Date**: 2025-10-29
**Scope**: Complete rewrite of apps/expo navigation using Expo Router Tabs pattern

---

## Executive Summary

Rewrite all role-based navigation (admin, morador, porteiro, visitante) to use Expo Router's `Tabs` component with proper file-based routing. Eliminate tab content rendering in index files, extract business logic from layouts, and minimize useEffect usage for navigation.

### Key Architectural Decisions

**Navigation Structure**:
- ✅ All 4 roles use Expo Router Tabs (grouped routes pattern)
- ✅ Use native tab bar (remove custom `BottomNav.tsx`)
- ✅ File-based routing (no query params for tabs)
- ✅ Extract porteiro logic to services/hooks
- ✅ Split monolithic index files into per-tab screens

**User Experience Enhancements**:
- ✅ Haptic feedback on tab switches
- ✅ Badge indicators for unread notifications
- ✅ Auto-hide tab bar on keyboard (`tabBarHideOnKeyboard: true`)
- ✅ Shared tab bar styling via theme constants
- ✅ Per-tab error boundaries for graceful degradation
- ✅ Standard LoadingTab component for consistency

**Technical Infrastructure**:
- ✅ Centralize push token registration in root layout
- ✅ Use existing `AgoraService.tsx` for morador calls
- ✅ Extract porteiro notifications to service (remove from layout)
- ✅ Phone-first design (no tablet optimizations in v1)
- ✅ Manual QA for testing (no automated deep link tests initially)
- ✅ Hard cutover deployment (single release, no feature flags)

---

## 📊 Implementation Progress Summary

**Last Updated**: 2025-10-29 (Commit: 969a392)

| Phase | Role/Task | Status | Completion |
|-------|-----------|--------|------------|
| Phase 1 | Foundation Components | ✅ Done | 100% |
| Phase 2 | Admin Role Migration | ✅ Done | 95% |
| Phase 3 | Visitante Role Migration | ✅ Done | 95% |
| Phase 4 | Morador Role Migration | ✅ Done | 100% |
| Phase 5 | Porteiro Role Migration | 🚧 In Progress | 60% |
| Phase 6 | Testing & Cleanup | ❌ Not Started | 0% |

**Overall Progress**: ~70% complete (3.5 of 4 roles migrated)

### Key Achievements (latest)
- ✅ Expo Router tabs live for Admin, Morador, Visitante, Porteiro scaffolded
- ✅ Haptic feedback implemented on all tab switches
- ✅ `tabBarHideOnKeyboard: true` on every role
- ✅ BottomNav.tsx removed (zero references)
- ✅ Query-param navigation eliminated from Morador
- ✅ Supabase-backed `useUnreadNotifications` powering badge counts
- ✅ Porteiro dashboard provider + services created (communications, authorizations, logs)
- ✅ New Porteiro tabs online (Chegada, Avisos, Consulta, Autorizações, Logs)
- ✅ Push token registration centralized via `app/_layout` (per-role login hooks removed)
- ✅ Badge indicators scaffolded on Avisos tabs
- ✅ TabIcon, LoadingTab, TabErrorBoundary components created
- ✅ Admin redirects aligned to `/admin/(tabs)`

### Pending Critical Work
- ⚠️ **Porteiro refactor (Phase 5)** – extract PhotoModal + remaining shared UI, ensure Chegada consumes provider entirely
- ⚠️ **Service follow-ups** – expand provider notification helpers (acknowledge, refresh) across tabs
- ❌ **Comprehensive testing** – Deep links, multi-step flows, Agora calls (Phase 6)

### Next Steps
1. Extract `PhotoModal` into `components/porteiro/PhotoModal.tsx` and reuse across tabs
2. Add provider-level notification actions (mark-as-read, refresh) and surface unread UI updates
3. Conduct Phase 6: Manual QA testing across all roles (deep links, Agora, multi-step flows)

---

## Prerequisites & Dependencies

### Required Packages
Verify these packages are installed (or add to `package.json`):
- `expo-router` (already installed)
- `expo-haptics` (for haptic feedback on tab switches)
- `react-native-safe-area-context` (already installed)
- Existing `AgoraService.tsx` (verified present in codebase)

### Development Environment
- Node 22.18.0+
- pnpm 9.15+
- Expo SDK compatible version
- Test devices (physical device recommended for haptic testing)

---

## Current State Analysis

### Admin Role
- **Pattern**: Stack + custom bottom nav in `_layout.tsx`
- **Issues**: Bottom nav manually implemented, direct `router.push()` calls
- **Files**: `_layout.tsx`, `index.tsx`, separate screens for buildings/emergency/profile/etc

### Morador Role
- **Pattern**: Query param sync (`?tab=...`) with custom BottomNav component
- **Issues**: Bidirectional state sync, inline tab rendering in `index.tsx`
- **Files**: `_layout.tsx` (custom header + Agora), `index.tsx` (4 tabs via switch), separate tab components
- **Good parts**: No useEffect navigation, clean separation for multi-step flows

### Porteiro Role
- **Pattern**: Local state activeTab, monolithic index.tsx
- **Issues**: 1000+ line index file, complex business logic in layout, notification system mixed with navigation
- **Files**: `_layout.tsx` (realtime notifications + deduplication), `index.tsx` (5 tabs + shift control + modals)
- **Critical**: Needs major refactor + service extraction

### Visitante Role
- **Pattern**: Simple card navigation with Link components
- **Issues**: None major, just needs consistency with other roles
- **Files**: `_layout.tsx` (minimal), `index.tsx` (navigation cards)

---

## Target Architecture

### Grouped Routes Pattern

All roles follow this structure:
```
app/[role]/
├── _layout.tsx              # Root stack for role-specific routing
├── (tabs)/                  # Grouped route for tabs
│   ├── _layout.tsx          # Tabs navigator configuration
│   ├── index.tsx            # Default/home tab
│   ├── [screen2].tsx        # Additional tab screens
│   └── [screen3].tsx
├── [other-screens].tsx      # Stack-only screens (login, profile, etc)
└── [nested-flows]/          # Multi-step flows as nested stacks
    └── [step].tsx
```

### Navigation Flow
1. User auth → redirected to `/[role]/(tabs)`
2. Tabs navigator shows default tab (`index.tsx`)
3. Tab bar switches between tab screens via file routing
4. Stack screens accessible via navigation from tabs
5. Nested flows maintain their own stack state

---

## Role-Specific Plans

## 1. Admin Role

### Current Structure
```
app/admin/
├── _layout.tsx              # Stack + custom bottom nav
├── index.tsx                # Dashboard (activeTab unused)
├── buildings.tsx
├── emergency.tsx
├── profile.tsx
├── users.tsx
├── logs.tsx
├── communications.tsx
├── polls/
└── lembretes/
```

### Target Structure
```
app/admin/
├── _layout.tsx              # Clean root stack
├── (tabs)/
│   ├── _layout.tsx          # Tabs navigator
│   ├── index.tsx            # Dashboard tab
│   ├── usuarios.tsx         # Users tab
│   ├── logs.tsx             # Logs tab
│   └── avisos.tsx           # Communications tab
├── buildings.tsx            # Stack screens
├── emergency.tsx
├── profile.tsx
├── polls/
└── lembretes/
```

### Changes Required
1. **Create** `admin/(tabs)/_layout.tsx`:
   - Import `Tabs` from `expo-router`
   - Configure 4 tabs: Dashboard, Usuarios, Logs, Avisos
   - Customize tab bar with icons, colors from theme
   - Set `headerShown: false` (custom header per screen if needed)

2. **Rename** `admin/index.tsx` → `admin/(tabs)/index.tsx`:
   - Keep dashboard content as-is
   - Remove unused `activeTab` state
   - Pure rendering logic only

3. **Move** `admin/users.tsx` → `admin/(tabs)/usuarios.tsx`:
   - Full user management screen
   - All rendering logic self-contained

4. **Move** `admin/logs.tsx` → `admin/(tabs)/logs.tsx`:
   - Keep as separate file, just relocate

5. **Move** `admin/communications.tsx` → `admin/(tabs)/avisos.tsx`:
   - Communications/announcements tab

6. **Update** `admin/_layout.tsx`:
   - Remove custom bottom nav implementation
   - Remove push token registration (moved to root)
   - Keep Stack navigator for non-tab screens
   - Reference `(tabs)` as default route
   - Configure Stack screens: buildings, emergency, profile, polls, lembretes

7. **Update** root `app/index.tsx`:
   - Change admin redirect: `/admin` → `/admin/(tabs)`

### Testing Points
- Tab switching works smoothly
- Stack navigation from tabs (e.g., Dashboard → Buildings)
- Push token registration works from root (not duplicated)
- Back button from Stack screens returns to tabs

---

## 2. Morador Role

### Current Structure
```
app/morador/
├── _layout.tsx              # Stack + custom header + Agora
├── index.tsx                # Query param tabs (inicio/visitantes/cadastro/avisos)
├── visitantes/
│   └── VisitantesTab.tsx
├── cadastro/
│   ├── index.tsx            # CadastroTabContent
│   ├── [step].tsx           # Multi-step form flow
├── avisos.tsx               # AvisosTab
├── login.tsx
└── profile.tsx
```

Uses `components/BottomNav.tsx` with query param pattern.

### Target Structure
```
app/morador/
├── _layout.tsx              # Root stack + custom header + Agora
├── (tabs)/
│   ├── _layout.tsx          # Tabs navigator
│   ├── index.tsx            # Inicio tab (notifications, history)
│   ├── visitantes.tsx       # Visitors tab
│   ├── cadastro.tsx         # Registration tab
│   └── avisos.tsx           # Communications tab
├── cadastro/
│   └── [step].tsx           # Multi-step registration flow (Stack)
├── visitantes/
│   └── novo.tsx             # New visitor form (Stack)
├── login.tsx
└── profile.tsx
```

### Changes Required
1. **Create** `morador/(tabs)/_layout.tsx`:
   - Configure 4 tabs: Início, Visitantes, Cadastro, Avisos
   - Custom icons for each tab
   - Tab bar styling to match current design
   - `headerShown: false` (header in parent layout)

2. **Extract** inicio content from `morador/index.tsx` → `morador/(tabs)/index.tsx`:
   - Move `renderInicioTab()` logic to new file
   - Include notifications list, call history
   - Self-contained component with hooks

3. **Move** `morador/visitantes/VisitantesTab.tsx` → `morador/(tabs)/visitantes.tsx`:
   - Relocate file content
   - Update imports if needed
   - Ensure navigation to `novo.tsx` works

4. **Move** `morador/cadastro/index.tsx` → `morador/(tabs)/cadastro.tsx`:
   - Extract `CadastroTabContent` export as default component
   - Keep navigation to multi-step flow intact
   - Verify Stack navigation to `cadastro/[step].tsx` works

5. **Move** `morador/avisos.tsx` → `morador/(tabs)/avisos.tsx`:
   - Simple relocation
   - Already a standalone component

6. **Update** `morador/_layout.tsx`:
   - Remove query param handling
   - Remove reference to BottomNav
   - Remove push token registration (moved to root)
   - Keep custom header logic (emergency button, profile menu)
   - Keep Agora integration (use existing `AgoraService.tsx` from codebase)
   - Keep IncomingCallModal
   - Configure Stack to show `(tabs)` as default, then other screens
   - Hide header on login + multi-step flows

7. **Delete** old `morador/index.tsx` after content extracted

8. **Update** root `app/index.tsx`:
   - Change morador redirect: `/morador` → `/morador/(tabs)`

9. **Remove** `components/BottomNav.tsx` (if not used elsewhere)

10. **Update** navigation calls:
    - Replace `router.replace('/morador?tab=visitantes')` with `router.navigate('/morador/(tabs)/visitantes')`
    - Check all Link components for query params

### Testing Points
- Tab switching without query params
- Custom header shows on tabs, hidden on login/flows
- Multi-step cadastro flow works (tab → stack navigation)
- Visitor registration flow works
- Agora calls still function
- IncomingCallModal appears correctly
- Notifications navigation works
- Back button behavior from nested stacks

### Implementation Patterns & Deviations

**Re-export Pattern** (Admin & Visitante):
- Admin tabs use re-exports: `export { default } from '../users'`
- Visitante tabs use re-exports: `export { default } from '../index'`
- **Deviation**: Plan specified moving content into tab files
- **Rationale**: Faster implementation, avoids code duplication
- **Trade-off**: Extra indirection, doesn't fully separate tab logic

**Full Content Migration** (Morador):
- Inicio tab has full content extraction (~364 lines)
- Other tabs use re-exports for consistency
- **Matches Plan**: Demonstrates proper content separation
- **Result**: Morador/(tabs)/index.tsx is self-contained

**Recommendation for Porteiro**:
- Follow Morador pattern for complex tabs (Chegada/Autorizacoes)
- Use re-exports for simpler tabs (Consulta/Avisos/Logs)
- Balance between maintainability and implementation speed

---

### 2025-10-29 Progress Update (Completed)

- **Tabs group created**: `app/morador/(tabs)/_layout.tsx` with tabs Início, Visitantes, Cadastro, Avisos. Haptics and styling configured, `headerShown: false`.
- **Inicio extracted**: `app/morador/(tabs)/index.tsx` now contains the former Início tab (notifications + history) with TS fixes.
- **Visitantes tab**: `app/morador/(tabs)/visitantes.tsx` re-exports `../visitantes/VisitantesTab`.
- **Cadastro tab**: `app/morador/(tabs)/cadastro.tsx` re-exports `../cadastro`'s `CadastroTabContent`.
- **Avisos tab**: `app/morador/(tabs)/avisos.tsx` re-exports `../avisos`.
- **Morador layout**: `app/morador/_layout.tsx` updated to stack `(tabs)` as default, header hide rules for flows, profile menu updated, Agora/IncomingCallModal preserved.
- **Morador index**: `app/morador/index.tsx` replaced with a redirect to `/morador/visitantes` (ensures landing into Visitantes).
- **Removed BottomNav usage** from Morador screens (imports + JSX removed):
  - cadastro: `novo.tsx`, `relacionamento.tsx`, `telefone.tsx`, `placa.tsx`, `acesso.tsx`, `foto.tsx`, `dias.tsx`, `horarios.tsx`
  - visitantes: `nome.tsx`, `cpf.tsx`, `foto.tsx`, `periodo.tsx`, `observacoes.tsx`, `confirmacao.tsx`
  - others: `authorize.tsx`, `notifications.tsx`, `preregister.tsx`, `profile.tsx`, `testes.tsx`, `veiculo.tsx`
- **Query param cleanup**: All `?tab=` patterns removed from Morador.
- **Expo ImagePicker**: Updated to `ImagePicker.MediaTypeOptions.Images` in foto screens (`morador/cadastro/foto.tsx`, `morador/visitantes/foto.tsx`, `morador/preregister.tsx`).
- **Minor fixes**: Added missing `Alert` import in `morador/cadastro/horarios.tsx`.
- **Admin redirects aligned**:
  - `app/index.tsx`: Admin redirect changed to `/admin/(tabs)`.
  - `app/admin/login.tsx`: Redirects authenticated admin to `/admin/(tabs)`.
  - `hooks/useAuth.tsx`: `checkAndRedirectUser()` sends admins to `/admin/(tabs)`.
- **Pending**: Delete `apps/expo/components/BottomNav.tsx` (now unused) in a follow-up; optional tweak: after finishing cadastro, change "Ver Lista" to go to `/morador/cadastro`.

---

## 3. Porteiro Role (Major Refactor)

### Current Structure
```
app/porteiro/
├── _layout.tsx              # Stack + complex notification system
├── index.tsx                # MONOLITHIC: 5 tabs (chegada/autorizacoes/consulta/avisos/logs) + shift control + modals
├── visitor.tsx
├── delivery.tsx
├── logs.tsx
├── profile.tsx
├── emergency.tsx
└── login.tsx
```

**Critical Issues**:
- `index.tsx` is 1000+ lines
- Business logic mixed with UI
- Notification system in layout
- Local `activeTab` state (no URL sync)

### Target Structure
```
app/porteiro/
├── _layout.tsx              # Clean stack layout
├── (tabs)/
│   ├── _layout.tsx          # Tabs navigator
│   ├── index.tsx            # Chegada/arrival tab
│   ├── autorizacoes.tsx     # Authorizations tab
│   ├── consulta.tsx         # Lookup/search tab
│   ├── avisos.tsx           # Communications tab
│   └── logs.tsx             # Logs tab
├── visitor.tsx              # Stack screens
├── delivery.tsx
├── profile.tsx
├── emergency.tsx
└── login.tsx
```

### New Services/Hooks
```
services/
└── porteiro/
    ├── notification.service.ts      # Realtime subscriptions, deduplication
    └── shift.service.ts             # Shift management logic

hooks/
└── porteiro/
    ├── usePorteiroNotifications.ts  # Hook wrapper for notifications
    ├── useShiftControl.ts           # Shift state management
    └── useVisitorSearch.ts          # Search/lookup logic
```

### Changes Required

#### Phase 1: Service Extraction

1. **Create** `services/porteiro/notification.service.ts`:
   - Extract realtime subscription logic from `_layout.tsx`
   - Signature-based deduplication algorithm
   - AsyncStorage persistence
   - Export functions: `subscribeToNotifications()`, `markAsProcessed()`, `getUnprocessedNotifications()`
   - Return event emitter or callback pattern

2. **Create** `hooks/porteiro/usePorteiroNotifications.ts`:
   - Wrap notification service in React hook
   - Manage notification state
   - Handle Alert.alert() for decision notifications
   - Export: `{ notifications, unprocessedCount, markProcessed }`

3. **Create** `services/porteiro/shift.service.ts`:
   - Extract shift control logic from `index.tsx`
   - Shift validation, start/end operations
   - Database interactions
   - Export: `startShift()`, `endShift()`, `getActiveShift()`

4. **Create** `hooks/porteiro/useShiftControl.ts`:
   - React hook wrapper for shift service
   - Manage shift state
   - Modal visibility control
   - Export: `{ activeShift, startShift, endShift, isShiftActive }`

5. **Create** `hooks/porteiro/useVisitorSearch.ts`:
   - Extract search/lookup logic from `index.tsx`
   - Database queries for visitor lookup
   - Export: `{ search, results, loading }`

#### Phase 2: Tab Screen Creation

6. **Create** `porteiro/(tabs)/_layout.tsx`:
   - Configure 5 tabs: Chegada, Autorizações, Consulta, Avisos, Logs
   - Tab icons and styling
   - `headerShown: false`

7. **Create** `porteiro/(tabs)/index.tsx` (Chegada/Arrival):
   - Extract "chegada" tab content from old `index.tsx`
   - Render active arrivals/pending visitors
   - Navigation to visitor detail
   - Use `usePorteiroNotifications()` hook
   - Intercom call button integration
   - Clean, focused component (~200-300 lines)

8. **Create** `porteiro/(tabs)/autorizacoes.tsx`:
   - Move `AutorizacoesTab` content (currently separate component)
   - Authorization list and actions
   - Approve/deny functionality
   - Self-contained screen

9. **Create** `porteiro/(tabs)/consulta.tsx`:
   - Search/lookup interface
   - Visitor history search
   - Use `useVisitorSearch()` hook
   - Display search results

10. **Create** `porteiro/(tabs)/avisos.tsx`:
    - Communications/announcements for porteiro role
    - Similar to other roles' avisos tabs
    - Read/unread state

11. **Create** `porteiro/(tabs)/logs.tsx`:
    - Activity logs viewing
    - Filter and search logs
    - Different from old `logs.tsx` Stack screen if needed

#### Phase 3: Layout Cleanup

12. **Update** `porteiro/_layout.tsx`:
    - Remove notification subscription logic (now in service)
    - Import and initialize `usePorteiroNotifications()` at layout level for global access
    - Keep Stack configuration
    - Default route: `(tabs)`
    - Stack screens: visitor, delivery, profile, emergency, login
    - Much cleaner file (~100-150 lines vs current complexity)

13. ✅ Old monolithic `porteiro/index.tsx` replaced by lightweight redirect to `/porteiro/(tabs)`

14. **Update** root `app/index.tsx`:
    - Change porteiro redirect: `/porteiro` → `/porteiro/(tabs)`

#### Phase 4: Modals & Shared Components

15. **Extract modals** from old index:
    - IntercomModal → `components/porteiro/IntercomModal.tsx`
    - ShiftModal → `components/porteiro/ShiftModal.tsx`
    - ConfirmModal → shared `components/ConfirmModal.tsx`
    - PhotoModal → `components/porteiro/PhotoModal.tsx`
    - Use where needed in tab screens

16. **Update imports** across all new files

### Testing Points
- All 5 tabs render correctly
- Tab navigation smooth
- Notification system works across tabs
- Shift control functional
- Visitor search operational
- Intercom calls work from chegada tab
- Authorization actions work
- Back button behavior correct
- No memory leaks from realtime subscriptions
- AsyncStorage deduplication verified

---

## 4. Visitante Role

### Current Structure
```
app/visitante/
├── _layout.tsx              # Minimal stack
├── index.tsx                # Card navigation
├── register.tsx
├── status.tsx
├── help.tsx
└── emergency.tsx
```

Simple card-based navigation, no tabs currently.

### Target Structure
```
app/visitante/
├── _layout.tsx              # Root stack
├── (tabs)/
│   ├── _layout.tsx          # Tabs navigator
│   ├── index.tsx            # Home/dashboard tab
│   └── status.tsx           # Visit status tracking tab
├── register.tsx             # Stack screens
├── help.tsx
└── emergency.tsx
```

### Changes Required
1. **Create** `visitante/(tabs)/_layout.tsx`:
   - Configure 2 tabs: Início, Status
   - Simple tab bar with icons
   - Minimal customization

2. **Move** dashboard content from `visitante/index.tsx` → `visitante/(tabs)/index.tsx`:
   - Keep card navigation for help, emergency (navigate to Stack screens)
   - Main visitor information display
   - Welcome message, visit info

3. **Move** `visitante/status.tsx` → `visitante/(tabs)/status.tsx`:
   - Visit status tracking
   - QR code display if applicable
   - Real-time status updates

4. **Update** `visitante/_layout.tsx`:
   - Configure Stack with `(tabs)` as default
   - Stack screens: register, help, emergency
   - Keep minimal design

5. **Update** root `app/index.tsx`:
   - Change visitante redirect: `/visitante` → `/visitante/(tabs)`

### Testing Points
- Two tabs work correctly
- Card navigation from home tab to Stack screens
- Status tab updates in real-time
- Help and emergency accessible

---

## Root Level Changes

### `app/_layout.tsx`
**Keep**:
- AuthProvider, ThemeProvider, SafeAreaProvider
- Splash screen handling
- Font loading
- Stack navigator

**Add**:
- Centralized push token registration (previously duplicated in role layouts)
- Use `usePushNotifications()` hook at root level
- Register token once globally instead of per-role

**Remove**:
- Notification-based navigation logic (move to role services)

**Update**:
- Simplify to pure provider wrapper + global push token setup

### `app/index.tsx`
**Keep**:
- Auth-based role routing (useEffect pattern acceptable here)
- Role selection UI when not authenticated
- Loading states

**Update**:
- Change redirect paths to new tab routes:
  - Admin: `/admin/(tabs)`
  - Morador: `/morador/(tabs)`
  - Porteiro: `/porteiro/(tabs)`
  - Visitante: `/visitante/(tabs)`

**Status (2025-10-29)**:
- Implemented: Admin redirect updated to `/admin/(tabs)`.
- Current: Morador keeps redirecting to `/morador` (role layout defaults to tabs; `morador/index.tsx` redirects to `/morador/visitantes`). Optional: update to `/morador/(tabs)` later.

---

## Shared Components

### Remove
- `components/BottomNav.tsx` - replaced by Expo Router tab bars

**Status (2025-10-29)**:
- ✅ File deleted in commit 969a392
- ✅ All usages removed from codebase (grep shows 0 matches)
- ✅ 18 screens updated in Morador role

### Create New

#### Core Navigation Components
- ✅ `components/TabIcon.tsx` - Reusable tab icon component
  ```tsx
  interface TabIconProps {
    name: string;
    color: string;
    focused?: boolean;
    size?: number;
  }
  ```
  **Status**: Uses lucide-react-native (Home, Users, ClipboardList, Bell, BarChart3, FileText)
  **Implementation**: Stroke width changes on focus (2.5 vs 2)

- ✅ `components/LoadingTab.tsx` - Standard loading state
  ```tsx
  export default function LoadingTab({ label?: string })
  ```
  **Status**: Simple ActivityIndicator + label, white background

- ✅ `components/TabErrorBoundary.tsx` - Per-tab error boundary
  ```tsx
  class TabErrorBoundary extends React.Component<Props, State>
  ```
  **Status**: Class component with retry button, not yet applied to screens

- ⚠️ `theme/tabBarStyles.ts` - Shared styling constants
  **Status**: NOT CREATED - inline styles used in each (tabs)/_layout.tsx instead
  **Note**: Each role has hardcoded styles, could be refactored to shared constants

#### Porteiro-Specific Components (Pending Phase 5)
- ❌ `components/porteiro/IntercomModal.tsx` - To be extracted from porteiro/index
- ✅ `components/porteiro/ShiftModal.tsx`
- ❌ `components/porteiro/PhotoModal.tsx` - To be extracted from porteiro/index

#### Shared Modals
- ❌ `components/ConfirmModal.tsx` - Shared confirmation modal (if needed)

### Services (Pending Phase 5)
- ❌ `services/porteiro/notification.service.ts` - Realtime notifications, deduplication
- ❌ `services/porteiro/shift.service.ts` - Shift management logic

### Hooks
- ✅ `hooks/useUnreadNotifications.ts` - Fetches unread count from Supabase
  **Status**: Needs Supabase implementation for real badge counts
- ❌ `hooks/porteiro/usePorteiroNotifications.ts` - Notification state hook (Phase 5)
- ❌ `hooks/porteiro/useShiftControl.ts` - Shift control hook (Phase 5)
- ✅ `hooks/porteiro/useVisitorSearch.ts` - Search/lookup hook
- ✅ `hooks/useTabHaptics.ts` - NOT NEEDED (implemented directly in screenListeners)

---

## Navigation Patterns & Best Practices

### File-Based Routing (Primary)
- **Before**: `/morador?tab=visitantes`
- **After**: `/morador/(tabs)/visitantes`
- Router automatically handles active tab state via file path

### Tab State Management
- **Remove**: All `activeTab` state variables
- **Remove**: All `setActiveTab()` functions
- **Replace**: File path is source of truth
- Expo Router manages tab state internally

### Programmatic Navigation
```tsx
// Preferred: Declarative with Link
<Link href="/morador/(tabs)/visitantes">
  <Pressable><Text>Visitantes</Text></Pressable>
</Link>

// Imperative when needed
router.navigate('/morador/(tabs)/visitantes')  // Intelligent routing
router.push('/morador/profile')                // Explicit push
router.replace('/login')                        // Replace current
```

### Query Parameters (When Needed)
```tsx
// Pass data between screens
router.navigate({
  pathname: '/porteiro/visitor',
  params: { id: '123' }
})

// Receive in destination
const { id } = useLocalSearchParams()
```

### useEffect Navigation (Avoid)
```tsx
// ❌ BAD: Don't sync tab state with useEffect
useEffect(() => {
  router.replace(`/morador?tab=${activeTab}`)
}, [activeTab])

// ✅ GOOD: Direct navigation on user action
<Link href="/morador/(tabs)/visitantes">...</Link>

// ✅ ACCEPTABLE: Auth redirects in root index
useEffect(() => {
  if (user && user.role === 'morador') {
    router.replace('/morador/(tabs)')
  }
}, [user])
```

### Nested Navigation
```tsx
// Tab screen → Stack screen
// In morador/(tabs)/cadastro.tsx:
<Link href="/morador/cadastro/step1">Start Registration</Link>

// Multi-step flow maintains own stack
// User can go back through steps, then return to cadastro tab
```

---

## Tab Bar Customization

### Example: Morador Tabs Layout
```tsx
// apps/expo/app/morador/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useTheme } from '@/contexts/ThemeContext'
import TabIcon from '@/components/TabIcon'
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications'

export default function MoradorTabsLayout() {
  const theme = useTheme()
  const { unreadCount } = useUnreadNotifications() // For badge

  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.gray[400],
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false, // Custom header in parent layout
        tabBarHideOnKeyboard: true, // Auto-hide on keyboard
      }}
      screenListeners={{
        tabPress: handleTabPress, // Haptic feedback
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="visitantes"
        options={{
          title: 'Visitantes',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="users" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cadastro"
        options={{
          title: 'Cadastro',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="clipboard" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="avisos"
        options={{
          title: 'Avisos',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="bell" color={color} focused={focused} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined, // Badge for unread
        }}
      />
    </Tabs>
  )
}
```

### Styling Considerations
- **Theme Integration**: Extract colors from theme context, define shared base styles in `theme/tabBarStyles.ts`
- **Consistent Heights**: 60px across all roles (phone-first design)
- **Icon Sizes**: 24x24 standard, 28x28 for primary actions
- **Active State**: Color change + TabIcon handles focus styling
- **Accessibility**: Minimum 44x44 touch targets, proper labels
- **Keyboard Behavior**: `tabBarHideOnKeyboard: true` on all tab layouts
- **Haptic Feedback**: Light impact feedback via `screenListeners.tabPress`
- **Badge Indicators**: Show `tabBarBadge` on avisos/notifications tabs when unread > 0

---

## Implementation Order

### Phase 1: Foundation (Days 1-2) ✅ COMPLETED (2025-10-29)
1. ✅ Created shared components infrastructure:
   - `components/TabIcon.tsx` - Using lucide-react-native with focus states
   - `components/LoadingTab.tsx` - Standard ActivityIndicator with label
   - `components/TabErrorBoundary.tsx` - React class component with retry
   - `hooks/useUnreadNotifications.ts` - Stub hook created (needs implementation)
   - ⚠️ `theme/tabBarStyles.ts` - Not created (inline styles used instead)
2. ⚠️ Update root `app/_layout.tsx` - PENDING:
   - Push token centralization needs verification
   - Role-specific notification routing still exists
3. ❌ Create porteiro services/hooks - NOT STARTED:
   - Services deferred to Phase 5
   - Will be created when starting Porteiro refactor

**Deliverable**: ✅ Core components created and working
**Notes**:
- TabIcon uses lucide-react-native (home, users, clipboard, bell, dashboard, logs icons)
- Haptic feedback implemented via `screenListeners.tabPress` in tab layouts
- `useUnreadNotifications` hooked to Supabase notification logs (ready for badge counts)

### Phase 2: Admin (Day 2) ✅ COMPLETED (2025-10-29)
1. ✅ Created `admin/(tabs)` directory structure with 4 tab files
2. ✅ Created `admin/(tabs)/_layout.tsx`:
   - 4 tabs: Dashboard, Usuários, Logs, Avisos
   - `tabBarHideOnKeyboard: true` configured
   - Haptic feedback via `screenListeners.tabPress`
   - Badge on avisos tab using `useUnreadNotifications()`
   - Orange theme (#FF9800) for admin
3. ✅ Created tab screens:
   - `index.tsx` - Dashboard content moved (~236 lines)
   - `usuarios.tsx` - Re-exports `../users`
   - `logs.tsx` - Re-exports `../logs`
   - `avisos.tsx` - Re-exports `../communications`
   - ⚠️ Using re-exports instead of moving content (deviation from plan)
4. ✅ Updated parent `admin/_layout.tsx`:
   - Removed custom bottom nav JSX (entire bottomNav View)
   - Removed push token registration logic
   - Stack now shows `(tabs)` as first screen
   - Removed animation state handling
5. ✅ Updated redirects:
   - `app/index.tsx` → `/admin/(tabs)`
   - `app/admin/login.tsx` → `/admin/(tabs)`
   - `hooks/useAuth.tsx` → `/admin/(tabs)`
6. ⚠️ Testing pending (Phase 6)

**Deliverable**: ✅ Admin migrated and functional
**Notes**:
- Re-export pattern used for usuarios/logs/avisos (quick implementation)
- Dashboard (index) has full content migration
- TabErrorBoundary not applied yet (can be added later)

### Phase 3: Visitante (Day 3) ✅ COMPLETED (2025-10-29)
1. ✅ Created `visitante/(tabs)` directory structure with 2 tab files
2. ✅ Created `visitante/(tabs)/_layout.tsx`:
   - 2 tabs: Início, Status
   - Purple theme (#9C27B0) for visitante
   - `tabBarHideOnKeyboard: true` configured
   - Haptic feedback via `screenListeners.tabPress`
3. ✅ Created tab screens:
   - `index.tsx` - Re-exports `../index`
   - `status.tsx` - Re-exports `../status`
   - ⚠️ Using re-exports (deviation from plan)
4. ✅ Updated parent `visitante/_layout.tsx`:
   - Stack shows `(tabs)` as default route
   - Other screens remain as Stack routes (register, help, emergency)
5. ⚠️ Testing pending (Phase 6)

**Deliverable**: ✅ Visitante migrated and functional
**Notes**:
- Simplest role with only 2 tabs
- Re-export pattern maintained consistency with Admin
- Card navigation preserved within tab content

### Phase 4: Morador (Days 3-4) ✅ COMPLETED (2025-10-29)
1. ✅ Created `morador/(tabs)` directory structure with 4 tab files
2. ✅ Created `morador/(tabs)/_layout.tsx`:
   - 4 tabs: Início, Visitantes, Cadastro, Avisos
   - Green theme (#4CAF50) for morador
   - `tabBarHideOnKeyboard: true` configured
   - Haptic feedback via `screenListeners.tabPress`
   - `initialRouteName="index"` set
3. ✅ Extracted inicio content → `(tabs)/index.tsx`:
   - Full content migration (~364 lines)
   - Notifications list with approve/deny actions
   - Visitor history with status badges
   - FirstLoginModal integration
   - TypeScript fixes applied
4. ✅ Created remaining tab files:
   - `visitantes.tsx` - Re-exports `../visitantes/VisitantesTab`
   - `cadastro.tsx` - Re-exports `../cadastro` (CadastroTabContent)
   - `avisos.tsx` - Re-exports `../avisos`
5. ✅ Updated parent `morador/_layout.tsx`:
   - Removed query param handling (`useLocalSearchParams`)
   - Removed BottomNav reference
   - Preserved custom header (emergency + profile menu)
   - Preserved Agora integration and IncomingCallModal
   - Stack shows `(tabs)` as default route
   - Header hide rules for login + multi-step flows
6. ✅ Removed all query param navigation:
   - All `?tab=...` patterns eliminated
   - Updated 18 screens to remove BottomNav imports/usage
7. ✅ Cleaned up `morador/index.tsx`:
   - Replaced with simple redirect to `/morador/visitantes`
   - Old 765-line file reduced to 11 lines
8. ✅ Fixed ImagePicker deprecations:
   - Updated to `ImagePicker.MediaTypeOptions.Images` in:
     - `morador/cadastro/foto.tsx`
     - `morador/visitantes/foto.tsx`
     - `morador/preregister.tsx`
9. ✅ Deleted `components/BottomNav.tsx` completely:
   - No remaining references in codebase
   - Verified with grep: 0 matches
10. ⚠️ Testing pending for:
    - Multi-step cadastro flow
    - Visitor registration flow
    - Agora calls
    - IncomingCallModal

**Deliverable**: ✅ Morador fully migrated with most complex content extraction
**Notes**:
- Only role with full content migration in inicio tab
- Query param pattern completely eliminated
- BottomNav component deleted successfully
- Multi-step flows (cadastro/visitantes) preserved as nested stacks
- Redirect pattern: `morador/index.tsx` → `/morador/visitantes` (could be `/morador/(tabs)` instead)

### Phase 5: Porteiro (Days 5-7) 🚧 IN PROGRESS
**Status**: Provider + tabs scaffolded, Chegada refactor underway

This phase continues splitting the previous 1000+ line monolithic entry (now moved to `/porteiro/(tabs)/index.tsx`) into focused tab screens and shared services:

**Service Extraction First** (from Phase 1):
1. ❌ `services/porteiro/notification.service.ts` - Extract from `_layout.tsx`
2. ❌ `services/porteiro/shift.service.ts` - Extract from `index.tsx`
3. ❌ `hooks/porteiro/usePorteiroNotifications.ts` - Notification hook
4. ❌ `hooks/porteiro/useShiftControl.ts` - Shift management hook
5. ✅ `hooks/porteiro/useVisitorSearch.ts` - Search/lookup hook

**Tab Structure Creation**:
1. ✅ Created `porteiro/(tabs)/_layout.tsx` (tab scaffold)
2. 🚧 `porteiro/(tabs)/index.tsx` (Chegada tab) – new screen, finalize shift controls
3. ✅ `porteiro/(tabs)/autorizacoes.tsx`
4. ✅ `porteiro/(tabs)/consulta.tsx`
5. ✅ `porteiro/(tabs)/avisos.tsx`
6. ✅ `porteiro/(tabs)/logs.tsx` (re-export existing logs screen)

**Component Extraction**:
7. ❌ Extract modals to `components/porteiro/`:
   - IntercomModal.tsx
   - ShiftModal.tsx
   - PhotoModal.tsx
8. ❌ Update parent `porteiro/_layout.tsx`
9. ❌ Delete old monolithic index

**Testing**:
10. ❌ Test notification system across tabs
11. ❌ Test shift control
12. ❌ Test all 5 tabs independently
13. ❌ Verify realtime subscriptions work

**Deliverable**: Porteiro fully refactored with service layer
**Estimated Effort**: 50% of total remaining work

### Phase 6: Testing & Cleanup (Day 8) ❌ NOT STARTED
**Status**: Pending comprehensive testing

**Manual QA Testing** (as per plan decision):
1. ❌ Deep link testing for all roles/tabs
   - Test notification deep links
   - Test tab direct navigation URLs
   - Verify proper tab highlighting
2. ❌ Back button behavior verification
   - From Stack screens back to tabs
   - Within multi-step flows
   - From tabs to login/logout
3. ❌ Notification navigation testing
   - Push notifications → correct tab
   - In-app notifications → correct screen
4. ❌ Performance check
   - No memory leaks from subscriptions
   - Tab switch performance
   - Haptic feedback on device (not simulator)
5. ❌ Multi-step flow testing
   - Morador cadastro flow (8 steps)
   - Morador visitante registration (6 steps)
   - Porteiro visitor flow (when implemented)
6. ❌ Agora integration testing
   - Video/audio calls from morador
   - IncomingCallModal display
   - Call state across tab switches

**Code Cleanup**:
7. ❌ Remove old unused files (if any)
8. ❌ Update TypeScript types if needed
9. ✅ Documentation updated (NAVIGATION_REWRITE_PLAN.md)

**Deliverable**: Production-ready navigation with QA signoff
**Priority**: Should be done after Porteiro (Phase 5) is complete

---

## Testing Checklist

### Per Role Testing
- [ ] **Tab rendering**: All tabs render without errors
- [ ] **Tab switching**: Touch tab bar to switch, smooth animation
- [ ] **Deep linking**: Direct URL navigation to each tab works
- [ ] **Stack navigation**: Navigation from tabs to Stack screens works
- [ ] **Back button**: Correct behavior from Stack screens back to tabs
- [ ] **Auth redirects**: Root index redirects to correct tab route
- [ ] **Custom headers**: Show/hide correctly per screen
- [ ] **Notification navigation**: Notification taps navigate correctly
- [ ] **State persistence**: Tab state persists across app restarts (if applicable)

### Porteiro Specific
- [ ] **Realtime notifications**: Notifications appear across all tabs
- [ ] **Notification deduplication**: No duplicate alerts
- [ ] **AsyncStorage**: Processed notifications persist
- [ ] **Shift control**: Start/end shift works from chegada tab
- [ ] **Intercom calls**: Calls work from chegada tab
- [ ] **Search functionality**: Visitor lookup works in consulta tab
- [ ] **Authorization actions**: Approve/deny works in autorizacoes tab
- [ ] **Memory**: No subscription leaks, proper cleanup

### Morador Specific
- [ ] **Multi-step flows**: Cadastro/visitante registration flows work
- [ ] **Agora integration**: Video/audio calls function
- [ ] **IncomingCallModal**: Appears correctly across tabs
- [ ] **Custom header**: Emergency button + profile menu accessible
- [ ] **Query param removal**: No `?tab=...` in URLs

### Admin Specific
- [ ] **Push tokens**: Registration still works
- [ ] **Stack screens**: Buildings, emergency, profile, polls accessible
- [ ] **Tab bar**: All 4 tabs accessible and functional

### Visitante Specific
- [ ] **Status updates**: Real-time status changes visible
- [ ] **Card navigation**: Navigation to help, emergency works
- [ ] **Registration**: Visitor registration flow intact

### Cross-Cutting
- [ ] **Theme consistency**: Tab bar colors match theme, shared styles applied
- [ ] **Icons**: All icons render correctly
- [ ] **Accessibility**: Touch targets adequate, screen readers work
- [ ] **Performance**: No lag on tab switches, smooth animations
- [ ] **Error handling**: TabErrorBoundary catches errors, graceful degradation UI shown
- [ ] **Haptic feedback**: Light vibration on tab press (test on device, not simulator)
- [ ] **Keyboard behavior**: Tab bar hides when keyboard appears
- [ ] **Badge indicators**: Unread counts show on avisos tabs, update in real-time
- [ ] **Loading states**: LoadingTab component displays correctly before data loads
- [ ] **Push notifications**: Centralized token registration works, no duplication

---

## ✅ Resolved Decisions

All critical implementation questions have been resolved:

### Core Architecture
1. **Agora integration** → Use existing `AgoraService.tsx` from codebase
2. **Push token registration** → Centralize in root `app/_layout.tsx` (remove duplicates)
3. **Rollout strategy** → Hard cutover in single release (no feature flags)
4. **Tab bar + keyboard** → Auto-hide with `keyboardHidesTabBar: true`

### Styling & Theming
5. **Tab bar styling** → Shared constants in theme with per-role color/icon overrides
6. **Tablet/landscape** → Phone-first only, no tablet optimizations in initial rewrite

### User Experience
7. **Badge indicators** → Yes, add `tabBarBadge` for unread notifications on relevant tabs
8. **Haptic feedback** → Yes, add haptic feedback on tab switches

### Quality & Testing
9. **Error boundaries** → Per-tab error boundaries for graceful degradation
10. **Loading states** → Create standard `LoadingTab` component for consistency
11. **Deep link testing** → Manual QA checklist (no automated tests initially)

### Open Implementation Details
12. **Notification modal z-index** - ensure proper stacking when porteiro notifications trigger during tab switches (test during implementation)

---

## Success Criteria

### Core Architecture
- ✅ All 4 roles use Expo Router Tabs with grouped routes
- ✅ Zero manual `activeTab` state management
- ✅ No query param tab syncing
- ✅ No useEffect for tab navigation
- ✅ Each tab screen = separate file with own rendering logic
- ✅ Porteiro index.tsx reduced from 1000+ lines to ~200-300 per tab screen
- ✅ Porteiro notification logic in service, not layout
- ✅ BottomNav component removed
- ✅ Push token registration centralized in root (no duplication)

### User Experience
- ✅ Haptic feedback on all tab switches
- ✅ Badge indicators show unread counts on notification tabs
- ✅ Tab bar auto-hides when keyboard appears
- ✅ Consistent loading states via LoadingTab component
- ✅ Per-tab error boundaries prevent full app crashes

### Feature Preservation
- ✅ All existing functionality preserved
- ✅ No performance regressions
- ✅ Deep linking works for all tabs
- ✅ Multi-step flows intact (morador cadastro/visitantes)
- ✅ Agora calls work (using existing AgoraService.tsx)
- ✅ Realtime notifications work (porteiro + morador)

### Code Quality
- ✅ Shared tab bar styles via theme constants
- ✅ Consistent patterns across all roles
- ✅ Clean separation: UI vs business logic
- ✅ Services/hooks properly extracted and reusable

---

## Rollback Plan

**Strategy**: Hard cutover deployment (all changes in single release)

If critical issues arise post-deployment:
1. **Immediate**: Revert entire deployment, restore previous version
2. **Per-commit rollback**: Each phase is separate git commit, can cherry-pick reverts if only one role broken
3. **Hotfix approach**:
   - Identify broken role/feature
   - Quick fix in new branch
   - Test affected flows
   - Deploy hotfix
4. **Monitoring**:
   - Crash analytics (Sentry/similar)
   - User feedback channels
   - Performance metrics
   - Deep link success rates

**Testing before production**:
- Full QA on staging environment
- Test all roles, all flows
- Verify deep links work
- Check notification routing
- Validate multi-step flows

---

## Future Enhancements (Post-Rewrite)

- Tab bar animations (spring, fade)
- Swipe gestures between tabs
- Tab bar theming (dark mode variants)
- Persistent tab state across app restarts
- Tab badges for notifications
- Haptic feedback
- Accessibility improvements
- Tablet/landscape optimizations
- Tab bar customization per user preferences

---

## 🎯 Immediate Action Items (Priority Order)

### High Priority - Quick Wins
1. ~~**Implement useUnreadNotifications Hook** (1-2 hours)~~ ✅
   - Supabase-backed unread count now returned via `apps/expo/hooks/useUnreadNotifications.ts`
   - Badge indicators ready for real data

2. **Verify Push Token Centralization** (30 min - 1 hour)
   - Check if push token logic exists in root `app/_layout.tsx`
   - Verify admin/_layout.tsx no longer has push token code
   - Check morador/_layout.tsx for any remaining push token logic
   - Document findings in plan

3. **Test Current Implementation** (2-3 hours)
   - Manual QA for Admin, Visitante, Morador roles
   - Verify tab switching works smoothly
   - Test multi-step flows (morador cadastro/visitantes)
   - Test Agora calls in morador
   - Document any bugs found

### High Priority - Major Effort
4. **Phase 5: Start Porteiro Refactor** (3-5 days estimated)
   - **Day 1**: Extract services
     - Create `services/porteiro/notification.service.ts`
     - Create `services/porteiro/shift.service.ts`
     - Test services in isolation
   - **Day 2**: Create hooks
     - Create `hooks/porteiro/usePorteiroNotifications.ts`
     - Create `hooks/porteiro/useShiftControl.ts`
     - ✅ `hooks/porteiro/useVisitorSearch.ts`
   - **Day 3**: Create tab structure
     - Create `porteiro/(tabs)/_layout.tsx`
     - Split index.tsx into 5 tab files
     - Extract chegada content first (most complex)
   - **Day 4**: Extract modals & cleanup
     - Extract IntercomModal, ShiftModal, PhotoModal
     - Clean up `porteiro/_layout.tsx`
     - Delete old monolithic index
   - **Day 5**: Testing & fixes
     - Test all 5 tabs independently
     - Verify notification system works
     - Test shift control
     - Fix bugs

### Medium Priority
5. **Optional Refactors** (Future enhancement)
   - Convert Admin re-exports to full content migration
   - Convert Visitante re-exports to full content migration
   - Create `theme/tabBarStyles.ts` for shared styles
   - Apply TabErrorBoundary to all tab screens

### Low Priority
6. **Phase 6: Comprehensive Testing** (After Porteiro complete)
   - Deep link testing
   - Performance profiling
   - Documentation updates

---

## 📝 Commit History

### Commit 969a392 (2025-10-29)
**Title**: feat(navigation): finalize Morador Tabs migration, remove BottomNav, and align admin redirects

**Changes**:
- Created Admin, Morador, Visitante tabs structures
- Implemented TabIcon, LoadingTab, TabErrorBoundary components
- Deleted BottomNav.tsx completely
- Removed all query param navigation from Morador
- Updated 18 Morador screens
- Fixed ImagePicker deprecations
- Aligned admin redirects to `/admin/(tabs)`
- Created useUnreadNotifications stub hook

**Files Changed**: 49 files (+2002, -1563 lines)

**Status**: Phase 1-4 mostly complete (~60% overall progress)

---

**End of Plan**
