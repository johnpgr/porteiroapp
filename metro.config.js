// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// Configure symbolication to collapse anonymous stack frames
config.symbolicator = {
  customizeFrame: (frame) => {
    const isAnonymous = frame.file === '<anonymous>' || (typeof frame.file === 'string' && frame.file.includes('<anonymous>'));
    return { collapse: isAnonymous };
  },
};

module.exports = config;
