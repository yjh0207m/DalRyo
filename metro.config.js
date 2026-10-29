const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
const config = {
  resolver: {
    // Java emulator sockets are not app sources and cannot be stat'ed on Windows.
    blockList: [...[defaultConfig.resolver.blockList].flat().filter(Boolean), /(?:^|[\\/])\.build-tmp(?:[\\/].*|$)/],
    assetExts: [...new Set([...defaultConfig.resolver.assetExts, 'riv'])],
  },
};

module.exports = mergeConfig(defaultConfig, config);
