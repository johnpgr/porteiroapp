// Early initialization for CallCoordinator
// Imported at bundle root (index.js) to ensure event handlers are ready
// even before React tree / authentication flows mount.
//
// NOTE: CallKeep permission request is SKIPPED here - it will be requested
// after user login in morador/_layout.tsx to avoid prompting before authentication.

import { callCoordinator } from './CallCoordinator';

// Fire-and-forget; initialize is idempotent
(async () => {
  try {
    // Skip CallKeep setup - permissions will be requested after login
    await callCoordinator.initialize(true);
    if (__DEV__) {
      // Helpful debug info after early init
      console.log('[earlyInit] CallCoordinator debug:', callCoordinator.getDebugInfo());
    }
  } catch (e) {
    console.warn('[earlyInit] Failed to early-initialize CallCoordinator:', e);
  }
})();
