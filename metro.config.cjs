const { getDefaultConfig } = require('@expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for lottie files
config.resolver.assetExts.push('lottie');

// In some environments, Node 17+ strict exports can break older Metro internal imports.
// This is a safety flag to ensure compatibility if the user is on a newer Node version.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
