import { useEffect } from 'react';
import { useAuth } from '~/hooks/useAuth';
import { supabase } from '~/utils/supabase';
import { agoraService } from '~/services/agora/AgoraService';
import { callKeepService } from '~/services/calling/CallKeepService';
import { callCoordinator } from '~/services/calling/CallCoordinator';

export function CallSystemInitializer() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !user.user_id) {
      return;
    }

    const initializeCallSystem = async () => {
      try {
        console.log('[MoradorLayout] 🚀 Initializing call system...');

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('notification_enabled')
          .eq('user_id', user.user_id!)
          .maybeSingle();

        if (error) {
          console.warn('[MoradorLayout] ⚠️ Could not fetch notification preference:', error);
        }

        if (!profile || profile.notification_enabled !== true) {
          console.log('[MoradorLayout] ⏭️ Skipping call system - notifications disabled for user');
          return;
        }

        agoraService.setCurrentUser({
          id: user.id,
          userType: 'morador',
          displayName: (user as any)?.user_metadata?.full_name || user.email || null,
        });

        console.log('[MoradorLayout] 🔐 Initializing RTM standby...');
        try {
          await agoraService.initializeStandby();
          console.log('[MoradorLayout] ✅ RTM standby initialized');
        } catch (rtmError) {
          console.error('[MoradorLayout] ❌ RTM initialization failed (non-critical):', rtmError);
        }

        await callKeepService.setup();
        console.log('[MoradorLayout] ✅ CallKeep initialized');

        await callCoordinator.initialize();
        console.log('[MoradorLayout] ✅ CallCoordinator initialized');
      } catch (error) {
        console.error('[MoradorLayout] ❌ Failed to initialize call system:', error);
      }
    };

    void initializeCallSystem();

    return () => {
      // no-op cleanup
    };
  }, [user]);

  return null;
}
