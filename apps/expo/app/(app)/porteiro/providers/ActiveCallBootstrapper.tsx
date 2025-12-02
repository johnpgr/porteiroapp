import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '~/hooks/useAuth';
import { callCoordinator } from '~/services/calling/CallCoordinator';
import { InterfoneAPI } from '~/services/api/InterfoneAPI';
import { supabase } from '~/utils/supabase';

export function ActiveCallBootstrapper() {
  const { user } = useAuth();
  const [callSystemReady, setCallSystemReady] = useState(() => {
    return callCoordinator.getDebugInfo().isInitialized;
  });
  const hasFetchedActiveCallsRef = useRef(false);

  useEffect(() => {
    if (!user?.id || user.user_type !== 'porteiro') {
      hasFetchedActiveCallsRef.current = false;
      setCallSystemReady(false);
    }
  }, [user?.id, user?.user_type]);

  useEffect(() => {
    const unsubscribe = callCoordinator.on('ready', () => {
      setCallSystemReady(true);
    });
    return unsubscribe;
  }, []);

  const resolveBuildingId = useCallback(async (): Promise<string | null> => {
    if (!user?.id || user.user_type !== 'porteiro') {
      return null;
    }

    if (user.building_id) {
      return user.building_id;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('building_id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[PorteiroLayout] ⚠️ Unable to resolve building ID:', error);
        return null;
      }

      return data?.building_id ?? null;
    } catch (err) {
      console.error('[PorteiroLayout] ❌ Failed to resolve building ID:', err);
      return null;
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id || user.user_type !== 'porteiro') {
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
          console.log('[PorteiroLayout] ⚠️ Skipping active calls fetch - missing buildingId');
          hasFetchedActiveCallsRef.current = false;
          return;
        }

        console.log('[PorteiroLayout] 🔄 Fetching active calls at startup for building:', buildingId);
        const result = await InterfoneAPI.getActiveCalls(buildingId);

        const activeCalls = result?.data?.activeCalls;
        if (!result?.success || !Array.isArray(activeCalls) || activeCalls.length === 0) {
          console.log('[PorteiroLayout] ℹ️ No active calls to restore');
          return;
        }

        for (const call of activeCalls) {
          const callId = call.id ?? call.call_id ?? call.callId;
          if (!callId) continue;

          const callerName =
            call.resident_name ||
            call.caller_name ||
            call.profiles?.full_name ||
            call.callerName ||
            'Morador';

          await callCoordinator.handleIncomingPush({
            callId: String(callId),
            from: String(call.initiator_id || call.profile_id || call.from || ''),
            callerName,
            apartmentNumber: call.apartment_number || call.apartments?.number || '',
            buildingName: call.building_name || '',
            channelName: call.channel_name || `call-${callId}`,
            timestamp: Date.now(),
            source: 'foreground',
            shouldShowNativeUI: false,
          });
        }
      } catch (error) {
        hasFetchedActiveCallsRef.current = false;
        console.error('[PorteiroLayout] ❌ Failed to fetch active calls:', error);
      }
    };

    void fetchActiveCallsOnStartup();
  }, [user?.id, user?.user_type, callSystemReady, resolveBuildingId]);

  return null;
}
