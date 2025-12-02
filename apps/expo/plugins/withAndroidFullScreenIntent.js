/**
 * Expo Config Plugin: Ensure Android full-screen call UX works across EAS prebuilds
 * - Adds uses-permission: USE_FULL_SCREEN_INTENT (idempotent)
 * - Adds android:showWhenLocked and android:turnScreenOn on MainActivity (idempotent)
 */

const { withAndroidManifest } = require('@expo/config-plugins');

function ensurePermission(manifest, permissionName) {
  const top = manifest.manifest || manifest;
  const list = top['uses-permission'] || [];
  const exists = list.some((p) => p?.$?.['android:name'] === permissionName);
  if (!exists) {
    list.push({ $: { 'android:name': permissionName } });
    top['uses-permission'] = list;
  }
}

function patchMainActivityAttributes(manifest) {
  const app = manifest.manifest?.application?.[0];
  if (!app) return;
  const activities = app.activity || [];
  const main = activities.find((a) => a?.$?.['android:name'] === '.MainActivity');
  if (!main) return;
  const attrs = main.$;
  if (attrs['android:showWhenLocked'] !== 'true') {
    attrs['android:showWhenLocked'] = 'true';
  }
  if (attrs['android:turnScreenOn'] !== 'true') {
    attrs['android:turnScreenOn'] = 'true';
  }
}

const withAndroidFullScreenIntent = (config) =>
  withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // 1) Ensure USE_FULL_SCREEN_INTENT permission
    ensurePermission(androidManifest, 'android.permission.USE_FULL_SCREEN_INTENT');

    // 2) Ensure MainActivity has lock/wake attributes for full-screen UI
    patchMainActivityAttributes(androidManifest);

    return config;
  });

module.exports = withAndroidFullScreenIntent;

