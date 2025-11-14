// Early initialization for CallCoordinator + CallKeep
// Imported at bundle root (index.js) to ensure CallKeep events are captured
// even before React tree / authentication flows mount.

import { callCoordinator } from './CallCoordinator';

// Fire-and-forget; initialize is idempotent
(async () => {
  try {
    await callCoordinator.initialize();
    if (__DEV__) {
      // Helpful debug info after early init
      console.log('[earlyInit] CallCoordinator debug:', callCoordinator.getDebugInfo());
    }
  } catch (e) {
    console.warn('[earlyInit] Failed to early-initialize CallCoordinator:', e);
  }
})();
