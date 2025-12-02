/**
 * Expo Config Plugin for Unified VoIP Push & CallKit Integration
 *
 * This plugin ONLY copies Objective-C files to the iOS project.
 * NO code injection needed - the +load method in VoipCallKitHandler.mm
 * runs automatically when the class is loaded by the Objective-C runtime.
 *
 * Zero Objective-C code in JavaScript strings!
 */

const fs = require('fs');
const path = require('path');
const { withDangerousMod, withEntitlementsPlist } = require('@expo/config-plugins');

const IOS_DIR = path.join(__dirname, 'ios');

/**
 * Copy Objective-C files to iOS project
 * That's all we need to do - the +load method handles everything else!
 */
function copyNativeFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosProjectPath = config.modRequest.platformProjectRoot;
      const targetDir = path.join(iosProjectPath, 'VoipCallKitHandler');

      // Create target directory
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copy header file
      const headerSource = path.join(IOS_DIR, 'VoipCallKitHandler.h');
      const headerDest = path.join(targetDir, 'VoipCallKitHandler.h');
      if (fs.existsSync(headerSource)) {
        fs.copyFileSync(headerSource, headerDest);
        console.log('[VoIP CallKit Plugin] ✅ Copied VoipCallKitHandler.h');
      }

      // Copy implementation file
      const implSource = path.join(IOS_DIR, 'VoipCallKitHandler.mm');
      const implDest = path.join(targetDir, 'VoipCallKitHandler.mm');
      if (fs.existsSync(implSource)) {
        fs.copyFileSync(implSource, implDest);
        console.log('[VoIP CallKit Plugin] ✅ Copied VoipCallKitHandler.mm');
      }

      return config;
    },
  ]);
}

/**
 * Main plugin function
 */
const withVoipCallKit = (config) => {
  // Step 1: Copy native Objective-C files to iOS project
  // The +load method in VoipCallKitHandler.mm will run automatically
  config = copyNativeFiles(config);

  // Step 2: Add VoIP entitlement to entitlements plist
  config = withEntitlementsPlist(config, (config) => {
    if (!config.modResults['voip']) {
      config.modResults['voip'] = true;
    }
    return config;
  });

  return config;
};

module.exports = withVoipCallKit;
