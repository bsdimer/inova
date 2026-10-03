const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @inova/shared is published to the services as built CommonJS in dist/, which
// is not committed. Bundling its TypeScript source keeps a fresh checkout
// startable without a build and picks up shared edits on reload.
const sharedEntry = path.resolve(__dirname, '../../packages/shared/src/index.ts');
const resolveDefault = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@inova/shared') {
    return { type: 'sourceFile', filePath: sharedEntry };
  }
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
