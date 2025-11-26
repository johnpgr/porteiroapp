# Plan: Bidirectional Intercom Calls Refactor

Refactor the intercom system to allow residents (morador) to call doormen (porteiro), add call history to the porteiro side, and add a floating call button to the morador calls screen. The changes require API modifications to support resident-initiated calls, new UI components for outgoing calls from morador, and reusing the existing calls screen for porteiro.

## Steps

1. **Extend API to support morador→porteiro calls** in `apps/interfone-api/src/controllers/call.controller.ts` and `call.routes.ts`
   - Add new endpoint `POST /api/calls/call-doorman` that accepts `buildingId` and initiates a call to the on-duty doorman
   - Modify `intercom_calls` table to make `doorman_id` nullable (for resident-initiated calls) or add `caller_type` / `caller_id` columns to track who initiated
   - Update push notification logic in `push.service.ts` to notify doorman devices

2. **Add database migration for bidirectional calls** in `supabase/migrations/`
   - Add columns: `caller_type ENUM('doorman', 'resident')`, `caller_id UUID` to `intercom_calls`
   - Or make `doorman_id` nullable and add `resident_caller_id` column
   - Update RLS policies if needed

3. **Create floating call button component** in `apps/expo/components/morador/`
   - Build `FloatingCallButton.tsx` - FAB style button positioned bottom-right
   - On press, opens an intercom modal to call the on-duty porteiro for the user's building

4. **Add outgoing call modal for morador** in `apps/expo/app/(app)/morador/`
   - Create `intercom.tsx` modal screen (similar to porteiro's but simplified - no keypad needed, just call building porteiro)
   - Integrate with existing `useIntercomCall.ts` hook after extending it for morador→porteiro flow

5. **Update calls screen** in `apps/expo/app/(app)/morador/(tabs)/calls.tsx`
   - Add the floating call button at bottom-right
   - Update query to also show calls initiated by the resident (outgoing calls)
   - Add visual distinction for outgoing vs incoming calls

6. **Add calls tab to porteiro side** in `apps/expo/app/(app)/porteiro/(tabs)/`
   - Copy/adapt the morador calls screen as `calls.tsx`
   - Update `_layout.tsx` to include the new Calls tab
   - Modify query to fetch calls made by or received by the doorman
   - Add the same floating call button for consistency (calls apartment via existing intercom flow)

## Design Decisions

1. **Morador→Porteiro call target**: Morador selects an on-duty porteiro from their condominium to call. The UI will show available on-duty doormen for the user's building.

2. **Database schema approach**: Rename columns to generic `initiator_id` + `initiator_type` (cleanest long-term approach). This allows any user type to initiate calls without schema ambiguity.

3. **VoIP for porteiro**: Yes, doormen will receive calls via VoIP/CallKeep like residents do. This requires extending the push notification and background task handling to support porteiro user types.
