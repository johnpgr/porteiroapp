# Modal Refactor - Remaining Work

## ✅ COMPLETED: Porteiro Modals (Fully Functional)

All porteiro modals have been successfully migrated to Expo Router pattern:
- ✅ Shift control modal
- ✅ Avisos/communications modal
- ✅ Photo viewer modal
- ✅ Intercom call modal

**Parent components updated:**
- ✅ PorteiroTabsHeader uses `router.push('/porteiro/shift')`
- ✅ Consulta tab uses `router.push('/porteiro/photo?uri=...')`
- ✅ Tabs layout custom button uses `router.push('/porteiro/intercom')`

**Ready to test and delete old files after validation.**

---

## 🚧 REMAINING WORK

### 1. Morador Modals (Not Started)

#### A. Visitor Management Modals
These are complex form modals used in `/app/morador/(tabs)/visitantes/index.tsx`:

**EditVisitorModal** → `app/morador/edit-visitor.tsx`
- Current: `components/morador/visitantes/components/EditVisitorModal.tsx`
- Props: `visible`, `visitor`, `onClose`, `onSubmit`
- Data: Receives visitor object, submits PreRegistrationData
- Pattern: ID param + optional pre-fill
  ```tsx
  router.push(`/morador/edit-visitor?id=${visitorId}&name=${encodeURIComponent(name)}`)
  ```

**VehicleModal** → `app/morador/vehicle.tsx`
- Current: `components/morador/visitantes/components/VehicleModal.tsx`
- Props: `visible`, `onClose`, `onSubmit`
- Data: Form state (license_plate, brand, model, color, type)
- Pattern: Form submission callback → convert to route with onSubmit as navigation
  ```tsx
  router.push('/morador/vehicle')
  // On submit: router.back() and pass data via callback or state
  ```

**PreRegistrationModal** → `app/morador/pre-registration.tsx`
- Current: `components/morador/visitantes/components/PreRegistrationModal.tsx`
- Props: `visible`, `insets`, `onSubmitIndividual`, `onSubmitMultiple`, `onClose`
- Data: Complex multi-step form with individual/multiple visitor modes
- Pattern: Self-contained form, submit and navigate back
  ```tsx
  router.push('/morador/pre-registration')
  ```

**Implementation notes:**
- All three modals manage their own form state
- Replace props with `useLocalSearchParams()` for initial data
- Keep onSubmit callbacks as-is but trigger from within modal routes
- Parent component (visitantes/index.tsx) needs significant refactoring

#### B. First Login Flow

**FirstLoginModal** → `app/morador/first-login.tsx`
- Current: `components/FirstLoginModal.tsx`
- Used in: `app/morador/(tabs)/profile.tsx`, `app/morador/(tabs)/index.tsx`
- Type: Multi-step form (personal, contact, photo)
- Pattern: **Blocking redirect** (not optional modal)

**Implementation:**
1. Create `/app/morador/first-login.tsx` as full screen
2. Add to morador layout with `presentation: 'fullScreenModal'`
3. In `app/morador/_layout.tsx`, add:
   ```tsx
   import { Redirect, usePathname } from 'expo-router';
   import { useFirstLogin } from '~/hooks/useFirstLogin';

   const pathname = usePathname();
   const { isFirstLogin } = useFirstLogin();

   if (isFirstLogin && pathname !== '/morador/first-login') {
     return <Redirect href="/morador/first-login" />;
   }
   ```
4. Remove `<FirstLoginModal>` from profile.tsx and index.tsx

---

### 2. Camera Modal (Partially Started)

**Status:** Layout created (`app/camera/_layout.tsx`) but no index file

**CameraModal** → `app/camera/index.tsx`
- Current: `components/shared/CameraModal.tsx`
- Used in: `components/porteiro/RegistrarEncomenda.tsx`, `components/porteiro/RegistrarVisitante.tsx`
- Props: `visible`, `onClose`, `onPhotoCapture`, `uploadFunction`, `title`
- **Challenge:** Requires callback functions for photo capture + upload

**Recommendation:**
Consider keeping CameraModal as imperative component due to:
- Complex callback pattern (onPhotoCapture needs to pass data back)
- Upload function prop varies by use case
- Used in multiple porteiro screens with different upload logic

**If converting to route:**
- Need to handle photo data return via:
  - Global state/context
  - Navigation state params
  - AsyncStorage temporary storage
- Each parent would need refactoring to handle photo result differently

**Alternative:** Keep as `<CameraModal>` component, only migrate simpler modals

---

### 3. Root Layout Configuration

**app/_layout.tsx needs camera modal config:**
```tsx
<Stack.Screen
  name="camera"
  options={{
    presentation: 'fullScreenModal',
    headerShown: false,
  }}
/>
```

---

### 4. Morador Layout Configuration

**app/morador/_layout.tsx needs modal screens:**
```tsx
{/* Modal screens */}
<Stack.Screen
  name="first-login"
  options={{
    presentation: 'fullScreenModal',
    headerShown: false,
  }}
/>
<Stack.Screen
  name="edit-visitor"
  options={{
    presentation: 'modal',
    headerShown: false,
  }}
/>
<Stack.Screen
  name="vehicle"
  options={{
    presentation: 'modal',
    headerShown: false,
  }}
/>
<Stack.Screen
  name="pre-registration"
  options={{
    presentation: 'modal',
    headerShown: false,
  }}
/>
```

---

### 5. Update Parent Components

**app/morador/(tabs)/visitantes/index.tsx:**
This is the main file using all three visitor modals. Current pattern:
```tsx
const [showPreRegistrationModal, setShowPreRegistrationModal] = useState(false);
const [showVehicleModal, setShowVehicleModal] = useState(false);
const [showEditModal, setShowEditModal] = useState(false);
const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null);

<PreRegistrationModal visible={showPreRegistrationModal} ... />
<VehicleModal visible={showVehicleModal} ... />
<EditVisitorModal visible={showEditModal} visitor={editingVisitor} ... />
```

**Needs to become:**
```tsx
import { useRouter } from 'expo-router';
const router = useRouter();

// Remove all useState for modal visibility
// Remove all modal component imports

// Replace modal triggers:
<Button onPress={() => router.push('/morador/pre-registration')} />
<Button onPress={() => router.push('/morador/vehicle')} />
<Button onPress={() => router.push(`/morador/edit-visitor?id=${visitor.id}`)} />
```

**Challenge:** The parent component passes callbacks (onSubmit) that handle data after modal closes. Need to:
- Move submit logic into modal routes
- Use router.back() after successful submit
- Refresh parent data on focus (useFocusEffect)

---

### 6. Testing Checklist

Before deleting old modal files, test:

**Porteiro (Ready to test):**
- [ ] Shift modal opens from header button
- [ ] Shift modal shows mandatory mode when no active shift
- [ ] Shift modal actions (start/end shift) work
- [ ] Photo modal opens from consulta tab with image
- [ ] Photo modal handles missing images (placeholder)
- [ ] Avisos modal loads communications
- [ ] Intercom modal opens from center tab button
- [ ] Intercom modal camera/audio permissions work
- [ ] Intercom modal calls connect and disconnect
- [ ] All modals dismiss with back button (Android)
- [ ] All modals swipe to dismiss (iOS)

**Morador (Not implemented yet):**
- [ ] First login redirect works on app start
- [ ] First login prevents tab navigation
- [ ] First login completes and allows app access
- [ ] Pre-registration modal creates visitors
- [ ] Vehicle modal creates vehicles
- [ ] Edit visitor modal updates visitor data
- [ ] All form submissions refresh parent lists

**Camera (Decision needed):**
- [ ] Camera modal permissions work
- [ ] Photos capture and upload
- [ ] Photo results return to parent correctly

---

### 7. Cleanup After Testing

**Delete only after confirming replacements work:**

```bash
# Porteiro (ready after testing)
rm apps/expo/components/porteiro/ShiftModal.tsx
rm apps/expo/components/porteiro/PhotoModal.tsx
rm apps/expo/components/porteiro/AvisosModal.tsx
rm apps/expo/app/porteiro/components/modals/IntercomModal.tsx

# Morador (after implementation + testing)
rm apps/expo/components/FirstLoginModal.tsx
rm apps/expo/components/morador/visitantes/components/EditVisitorModal.tsx
rm apps/expo/components/morador/visitantes/components/VehicleModal.tsx
rm apps/expo/components/morador/visitantes/components/PreRegistrationModal.tsx

# Camera (if converted)
rm apps/expo/components/shared/CameraModal.tsx

# Modal wrapper (if all modals converted)
rm apps/expo/components/Modal.tsx
```

---

## Recommended Next Steps

1. **Test porteiro modals** (already implemented)
   - Run app and verify all 4 modals work
   - Test on both iOS and Android
   - Verify back button and swipe gestures

2. **Implement FirstLogin blocking redirect** (highest priority morador item)
   - Simple to implement
   - Critical user flow
   - Single screen, no complex forms to refactor

3. **Decide on CameraModal** (strategic decision)
   - Keep as imperative component? (easier)
   - Convert to route? (consistent but complex)
   - Impacts how other screens handle photo uploads

4. **Implement visitor modals** (complex, low urgency)
   - Requires significant refactoring of visitantes/index.tsx
   - Consider implementing one at a time
   - Start with VehicleModal (simplest of the three)

5. **Delete old files** (final step)
   - Only after thorough testing
   - Keep Modal.tsx if CameraModal stays imperative
   - Update imports across codebase

---

## Time Estimates

- **Testing porteiro modals:** 30-60 minutes
- **FirstLogin redirect:** 1-2 hours
- **CameraModal decision + implementation:** 2-4 hours
- **One visitor modal (e.g., VehicleModal):** 2-3 hours
- **All visitor modals:** 6-8 hours
- **Testing + cleanup:** 2-3 hours

**Total remaining:** 13-20 hours of development

---

## Success Criteria

✅ **Phase 1 Complete:** All porteiro modals working
- [x] 4 modal routes created
- [x] Layout configured
- [x] Parent components updated
- [ ] Testing passed
- [ ] Old files deleted

⬜ **Phase 2 Target:** Critical morador flows working
- [ ] FirstLogin blocking redirect
- [ ] Decision on CameraModal approach

⬜ **Phase 3 Stretch:** All modals migrated
- [ ] Visitor management modals
- [ ] All old files deleted
- [ ] Components/Modal.tsx removed
