import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '~/hooks/useAuth';
import { useUserApartment } from '~/hooks/useUserApartment';
import { isRegularUser } from '~/types/auth.types';
import { supabase } from '~/utils/supabase';
import { callCoordinator } from '~/services/calling/CallCoordinator';
import { InterfoneAPI } from '~/services/api/InterfoneAPI';

export function ActiveCallBootstrapper() {
  const { user } = useAuth();
  const { apartment } = useUserApartment();
  const [callSystemReady, setCallSystemReady] = useState(() => {
    return callCoordinator.getDebugInfo().isInitialized;
  });
  const hasFetchedActiveCallsRef = useRef(false);

  useEffect(() => {
    if (!user?.id) {
      hasFetchedActiveCallsRef.current = false;
      setCallSystemReady(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const unsubscribe = callCoordinator.on('ready', () => {
      setCallSystemReady(true);
    });
    return unsubscribe;
  }, []);

  const resolveBuildingId = useCallback(async (): Promise<string | null> => {
    if (!user?.id) {
      return null;
    }

    if (isRegularUser(user) && user.building_id) {
      return user.building_id;
    }

    if (apartment?.id) {
      try {
        const { data, error } = await supabase
          .from('apartments')
          .select('building_id')
          .eq('id', apartment.id)
          .maybeSingle();

        if (error) {
          console.warn('[MoradorLayout] ⚠️ Unable to resolve building ID from apartment:', error);
          return null;
        }

        return data?.building_id ?? null;
      } catch (err) {
        console.error('[MoradorLayout] ❌ Failed to resolve building ID from apartment:', err);
        return null;
      }
    }

    console.log('[MoradorLayout] ⚠️ Unable to resolve building ID (no user/apartment data)');
    return null;
  }, [user, apartment?.id]);

  useEffect(() => {
    if (!user?.id) {
      hasFetchedActiveCallsRef.current = false;
      return;
    }

    if (!callSystemReady || hasFetchedActiveCallsRef.current) {
      return;
    }

    hasFetchedActiveCallsRef.current = true;

    const fetchActiveCallsOnStartup = async () => {
      try {
        const buildingId = await resolveBuildingId();
        if (!buildingId) {
          console.log('[MoradorLayout] ⚠️ Skipping active calls fetch - missing buildingId');
          hasFetchedActiveCallsRef.current = false;
          return;
        }

        console.log('[MoradorLayout] 🔄 Fetching active calls at startup for building:', buildingId);
        const result = await InterfoneAPI.getActiveCalls(buildingId);

        const activeCalls = result?.data?.activeCalls;
        if (!result?.success || !Array.isArray(activeCalls) || activeCalls.length === 0) {
          console.log('[MoradorLayout] ℹ️ No active calls to restore');
          return;
        }

        for (const call of activeCalls) {
          const callId = call.id ?? call.call_id ?? call.callId;
          if (!callId) continue;

          const callerName =
            call.doorman_name ||
            call.caller_name ||
            call.initiator_profile?.full_name ||
            call.profiles?.full_name ||
            call.callerName ||
            'Porteiro';

          await callCoordinator.handleIncomingPush({
            callId: String(callId),
            from: String(call.initiator_id || call.profile_id || call.from || ''),
            callerName,
            apartmentNumber: call.apartment_number || call.apartments?.number || '',
            buildingName: call.building_name || '',
            channelName: call.channel_name || `call-${callId}`,
            timestamp: Date.now(),
            source: 'foreground', // Active call recovery on app startup
            shouldShowNativeUI: false, // Recovery: restore session/UI, don't show new incoming call UI
          });
        }
      } catch (error) {
        hasFetchedActiveCallsRef.current = false;
        console.error('[MoradorLayout] ❌ Failed to fetch active calls:', error);
      }
    };

    void fetchActiveCallsOnStartup();
  }, [user?.id, callSystemReady, resolveBuildingId]);

  return null;
}
