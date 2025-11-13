// Expo config plugin to ensure react-native-callkeep's ConnectionService declaration
// See upstream discussion: https://github.com/react-native-webrtc/react-native-callkeep/issues/289
// This makes native generation (CNG) deterministic: you don't need to manually edit AndroidManifest.xml.
// Idempotent: will not add duplicate service entries.

const { withAndroidManifest } = require('@expo/config-plugins');

function ensureCallKeepService(androidManifest) {
  const manifest = androidManifest.manifest;
  if (!manifest.application || !manifest.application[0]) {
    return androidManifest; // nothing to do
  }
  const application = manifest.application[0];

  const targetServiceName = 'io.wazo.callkeep.VoiceConnectionService';

  // Existing services array
  application.service = application.service || [];

  const alreadyExists = application.service.some(
    (svc) => svc.$ && svc.$['android:name'] === targetServiceName
  );
  if (alreadyExists) {
    return androidManifest; // idempotent
  }

  application.service.push({
    $: {
      'android:name': targetServiceName,
      'android:label': '@string/app_name',
      'android:exported': 'true',
      // Critical: set permission so only system telecom can bind; app does not "gain" this permission.
      'android:permission': 'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
    },
    'intent-filter': [
      {
        action: [
          { $: { 'android:name': 'android.telecom.ConnectionService' } },
        ],
      },
    ],
  });

  return androidManifest;
}

const withCallKeepConnectionService = (config) => {
  return withAndroidManifest(config, (configProps) => {
    configProps.modResults = ensureCallKeepService(configProps.modResults);
    return configProps;
  });
};

module.exports = withCallKeepConnectionService;