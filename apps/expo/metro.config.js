// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Configure symbolication to collapse anonymous stack frames
config.symbolicator = {
  customizeFrame: (frame) => {
    const isAnonymous =
      frame.file === '<anonymous>' ||
      (typeof frame.file === 'string' && frame.file.includes('<anonymous>'));
    return { collapse: isAnonymous };
  },
};

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Support package exports field
config.resolver.unstable_enablePackageExports = true;

// Custom resolver to handle ~ alias
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('~/')) {
    // Replace ~ with the project root path
    const resolvedPath = path.resolve(projectRoot, moduleName.substring(2));
    return context.resolveRequest(context, resolvedPath, platform);
  }
  
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
