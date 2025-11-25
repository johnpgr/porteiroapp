/**
 * Expo config plugin to keep the app foregrounded when answering via CallKeep (Android).
 * - Copies a Kotlin helper into the native project (no Java/Kotlin embedded in JS strings)
 * - Injects minimal references into MainActivity to set window flags and forward callUUID to JS
 */

const fs = require('fs');
const path = require('path');
const { withDangerousMod, withMainActivity } = require('@expo/config-plugins');

const TEMPLATE_FILE = path.join(__dirname, 'android', 'CallKeepForegroundHelper.kt');

function getAndroidPackage(config) {
  const pkg = config.android?.package || config.expo?.android?.package;
  return pkg || 'com.porteiroapp.notifications';
}

function copyHelperFile(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const packageName = getAndroidPackage(config);
    const packagePath = packageName.replace(/\./g, '/');
    const projectRoot = config.modRequest.platformProjectRoot;
    const destDir = path.join(projectRoot, 'app', 'src', 'main', 'java', packagePath, 'callkeep');
    fs.mkdirSync(destDir, { recursive: true });

    const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
    const contents = template.replace(/__PACKAGE_NAME__/g, packageName);
    const destFile = path.join(destDir, 'CallKeepForegroundHelper.kt');
    fs.writeFileSync(destFile, contents);
    return config;
  }]);
}

function ensureImport(contents, importLine) {
  if (contents.includes(importLine)) {
    return contents;
  }
  const match = contents.match(/(^import .+\n)+/m);
  if (match && match[0]) {
    return contents.replace(match[0], `${match[0]}${importLine}\n`);
  }
  return contents;
}

function ensureOnCreateCalls(contents) {
  if (contents.includes('CallKeepForegroundHelper.applyWindowFlags')) {
    return contents;
  }

  const needle = 'super.onCreate(null)';
  if (!contents.includes(needle)) {
    return contents;
  }

  const patch = `${needle}\n\n    CallKeepForegroundHelper.applyWindowFlags(this)\n    CallKeepForegroundHelper.handleIntent(this, intent)`;
  return contents.replace(needle, patch);
}

function ensureOnNewIntent(contents) {
  const helperCall = 'CallKeepForegroundHelper.handleIntent(this, intent)';
  if (contents.includes('override fun onNewIntent')) {
    if (!contents.includes(helperCall)) {
      contents = contents.replace(
        /override fun onNewIntent\(intent: Intent\??\) \{\s*super.onNewIntent\(intent\)/,
        `override fun onNewIntent(intent: Intent) {\n    super.onNewIntent(intent)\n    setIntent(intent)\n    ${helperCall}`
      );
    }
    return contents;
  }

  const block = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    ${helperCall}
  }
`;

  return contents.replace(/\n}\s*$/, `${block}\n}\n`);
}

const withCallKeepForeground = (config) => {
  config = copyHelperFile(config);

  config = withMainActivity(config, (config) => {
    const packageName = getAndroidPackage(config);
    const helperImport = `import ${packageName}.callkeep.CallKeepForegroundHelper`;
    const intentImport = 'import android.content.Intent';

    let contents = config.modResults.contents;
    contents = ensureImport(contents, intentImport);
    contents = ensureImport(contents, helperImport);
    contents = ensureOnCreateCalls(contents);
    contents = ensureOnNewIntent(contents);

    config.modResults.contents = contents;
    return config;
  });

  return config;
};

module.exports = withCallKeepForeground;
