import { useEffect } from 'react';
import { useAuth } from '~/hooks/useAuth';
import { supabase } from '~/utils/supabase';
import { agoraService } from '~/services/agora/AgoraService';
import { callCoordinator } from '~/services/calling/CallCoordinator';
import { callKeepService } from '~/services/calling/CallKeepService';

export function CallSystemInitializer() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.user_type !== 'porteiro' || !user.user_id) {
      return;
    }

    const authUserId = user.user_id;
    if (!authUserId) {
      return;
    }

    const initializeCallSystem = async () => {
      try {
        console.log('[PorteiroLayout] 🚀 Initializing call system...');

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('notification_enabled')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (error) {
          console.warn('[PorteiroLayout] ⚠️ Could not fetch notification preference:', error);
        }

        if (!profile || profile.notification_enabled !== true) {
          console.log('[PorteiroLayout] ⏭️ Skipping call system - notifications disabled for user');
          return;
        }

        const displayName = (user as any)?.full_name || user.email || null;

        agoraService.setCurrentUser({
          id: user.id,
          userType: 'porteiro',
          displayName,
        });
        callCoordinator.setCurrentUser({
          id: user.id,
          userType: 'porteiro',
          displayName,
        });

        await callKeepService.setup();
        console.log('[PorteiroLayout] ✅ CallKeep initialized');

        await callCoordinator.initialize();
        console.log('[PorteiroLayout] ✅ CallCoordinator initialized');
      } catch (error) {
        console.error('[PorteiroLayout] ❌ Failed to initialize call system:', error);
      }
    };

    void initializeCallSystem();
  }, [user]);

  return null;
}
