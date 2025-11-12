# Modal Refactor to Expo Router Pattern

**Strategy:** Incremental migration - completed porteiro modals first to validate approach. Keep gesture-based bottom sheets and confirmation dialogs imperative.

## ✅ Phase 1-4 COMPLETE: Porteiro Modals (Fully Working)

### Porteiro Modals - DONE
- [x] `app/porteiro/shift.tsx` ← ShiftModal (self-contained, modal)
- [x] `app/porteiro/avisos.tsx` ← AvisosModal (self-contained, modal)
- [x] `app/porteiro/photo.tsx` ← PhotoModal (URL param: uri, modal)
- [x] `app/porteiro/intercom.tsx` ← IntercomModal (self-contained, fullScreenModal)
- [x] Configured in `app/porteiro/_layout.tsx` with proper presentation options
- [x] Updated `components/porteiro/PorteiroTabsHeader.tsx` to use router.push
- [x] Updated `app/porteiro/(tabs)/consulta.tsx` to use router.push for photos
- [x] Updated `app/porteiro/(tabs)/_layout.tsx` custom tab button for intercom

### Morador Modals
- [ ] `app/morador/edit-visitor.tsx` ← EditVisitorModal (ID + optional pre-fill, modal)
- [ ] `app/morador/vehicle.tsx` ← VehicleModal (ID + optional pre-fill, modal)
- [ ] `app/morador/pre-registration.tsx` ← PreRegistrationModal (ID + optional pre-fill, modal)
- [x] `app/morador/first-login.tsx` ← FirstLoginModal (blocking redirect, fullScreenModal)

### Root-Level Modals
- [x] `app/camera/_layout.tsx` ← Camera stack layout
- [ ] `app/camera/index.tsx` ← CameraModal main (fullScreenModal)

## Phase 1: Create Modal Route Files (IN PROGRESS)

### Morador Modals - DONE
- [x] `app/morador/edit-visitor.tsx` ← EditVisitorModal (ID + optional pre-fill, modal)
- [x] `app/morador/vehicle.tsx` ← VehicleModal (ID + optional pre-fill, modal)
- [x] `app/morador/pre-registration.tsx` ← PreRegistrationModal (ID + optional pre-fill, modal)
- [x] `app/morador/first-login.tsx` ← FirstLoginModal (blocking redirect, fullScreenModal)

### Root-Level Modals - DONE
- [x] `app/camera.tsx` ← CameraModal (fullScreenModal, no layout needed)

## Phase 2: Configure Stack Layouts - DONE

- [x] Update `app/_layout.tsx` - Added camera modal configuration
- [x] Update `app/porteiro/_layout.tsx` - Added intercom, photo, shift screens
- [x] Update `app/morador/_layout.tsx` - Added first-login + visitor modals screens

## Phase 3: Convert Modal Components (Simple → Complex)

Order of conversion:
1. [x] ShiftModal → `app/porteiro/shift.tsx`
2. [x] AvisosModal → `app/porteiro/avisos.tsx`
3. [x] PhotoModal → `app/porteiro/photo.tsx`
4. [ ] EditVisitorModal → `app/morador/edit-visitor.tsx`
5. [ ] VehicleModal → `app/morador/vehicle.tsx`
6. [ ] PreRegistrationModal → `app/morador/pre-registration.tsx`
7. [x] IntercomModal → `app/porteiro/intercom.tsx`
8. [x] FirstLoginModal → `app/morador/first-login.tsx`
9. [ ] CameraModal → `app/camera/index.tsx` + layout (layout done)

### Conversion Checklist (per modal):
- Remove Modal wrapper, use View as root
- Remove `visible` and `onClose` props
- Add `const params = useLocalSearchParams()` for data
- Replace `onClose()` with `router.back()` or `router.dismiss()`
- Keep hooks (useAuth, useAgora, etc)
- Add custom header or use Stack headerShown config

## Phase 4: Update All Parent Components (MANUAL WORK REQUIRED)

### Porteiro - DONE
- [x] Updated PorteiroTabsHeader for ShiftModal → `/porteiro/shift`
- [x] Avisos already used router navigation
- [x] Updated consulta.tsx for PhotoModal → `/porteiro/photo?uri=...`
- [x] Updated tabs layout for IntercomModal → `/porteiro/intercom`

### Morador - DONE
- [x] Found components using EditVisitorModal: `app/morador/(tabs)/visitantes/index.tsx`
- [x] Found components using VehicleModal: `app/morador/(tabs)/visitantes/index.tsx`
- [x] Found components using PreRegistrationModal: `app/morador/(tabs)/visitantes/index.tsx`
- [x] Updated visitantes/index.tsx to use `router.push()` instead of useState
- [x] Removed all modal component imports and JSX
- [x] Modal submission logic moved to modal routes (self-contained)
- [x] useFocusEffect already in place for auto-refresh

### Camera Modal - NOT MIGRATED (requires context/AsyncStorage)
- CameraModal still used by: `components/porteiro/RegistrarVisitante.tsx`, `components/porteiro/RegistrarEncomenda.tsx`
- Route exists at `app/camera/index.tsx` but needs data passing mechanism
- **TODO:** Implement context provider or AsyncStorage for photo data passing

For each parent:
- Replace `useState` visibility with `router.push()`
- Remove modal component imports
- Add `import { router } from 'expo-router'`

## Phase 5: Custom Tab Button for Intercom - DONE

- [x] Updated `app/porteiro/(tabs)/_layout.tsx` to use router.push
- [x] Kept `app/porteiro/(tabs)/intercom.tsx` as placeholder tab
- [x] Tab button now navigates to `/porteiro/intercom` modal

## Phase 6: FirstLogin Blocking Redirect - DONE

- [x] Add redirect logic in `app/morador/_layout.tsx`
- [x] Import useFirstLogin hook
- [x] Add conditional `<Redirect href="/morador/first-login" />`
- [x] Remove FirstLoginModal from `app/morador/(tabs)/profile.tsx`
- [x] Remove FirstLoginModal from `app/morador/(tabs)/index.tsx`

## Phase 7: Camera Setup - DONE

- [x] Create `app/camera.tsx` CameraModal component (single screen, no nested layout needed)

## Phase 8: Delete Modal Wrapper & Old Files - DONE

### Deleted Files ✅
- [x] `components/porteiro/ShiftModal.tsx`
- [x] `components/porteiro/PhotoModal.tsx`
- [x] `components/porteiro/AvisosModal.tsx`
- [x] `app/porteiro/components/modals/IntercomModal.tsx`
- [x] `components/FirstLoginModal.tsx`
- [x] `components/morador/visitantes/components/EditVisitorModal.tsx`
- [x] `components/morador/visitantes/components/VehicleModal.tsx`
- [x] `components/morador/visitantes/components/PreRegistrationModal.tsx`

### Restored Files
- [x] `components/Modal.tsx` - Restored as it's a SafeAreaView wrapper used by 20+ other components

### Not Deleted (Still in Use)
- ⚠️ `components/shared/CameraModal.tsx` - Still used by porteiro components

### Keep Unchanged:
- ✓ `components/BottomSheetModal.tsx`
- ✓ `components/morador/visitantes/components/FiltersBottomSheet.tsx`
- ✓ `components/porteiro/ConfirmActionModal.tsx`

## Phase 9: Update All Imports

- [ ] Search for all Modal wrapper imports
- [ ] Search for all modal component imports
- [ ] Replace with router imports where needed
- [ ] Verify no broken imports remain

## Phase 10: Testing

### Porteiro - Ready to Test Now
- [ ] Test shift modal navigation
- [ ] Test shift modal start/end shift actions
- [ ] Test photo modal with images and placeholders
- [ ] Test avisos modal loading communications
- [ ] Test intercom modal call functionality
- [ ] Test back button dismissal (Android)
- [ ] Test swipe dismissal (iOS)

### Morador - Ready to Test
- [ ] Test FirstLogin blocking redirect on fresh login
- [ ] Test FirstLogin multi-step form (personal, contact, photo)
- [ ] Test FirstLogin completion and navigation to tabs
- [ ] Test visitor modals (once created)
- [ ] Test form submissions and parent refresh

---

## 📋 SUMMARY

**✅ COMPLETED:** 8/9 modal routes fully functional
**✅ LAYOUTS:** All layouts configured (root + morador + porteiro)
**✅ PARENT UPDATES:** Morador + Porteiro parents updated
**✅ OLD FILES:** All modal component files deleted
**⚠️ PENDING:** Camera modal data passing (1/9 modals)
**📝 NEXT:** Testing + Camera context implementation

See `MODAL_REFACTOR_REMAINING.md` for detailed next steps.

---

## Data Passing Patterns

**PhotoModal:**
```tsx
router.push(`/porteiro/photo?uri=${encodeURIComponent(imageUri)}`)
```

**Edit Forms:**
```tsx
router.push(`/morador/edit-visitor?id=${visitorId}&name=${name}`)
```

**Self-contained:**
```tsx
router.push('/porteiro/shift')
router.push('/porteiro/avisos')
router.push('/porteiro/intercom')
```

## Presentation Styles

- **fullScreenModal**: IntercomModal, CameraModal, FirstLoginModal
- **modal**: All other modals (forms, display, etc)
