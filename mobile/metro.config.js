const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable support for worklets and reanimated
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Add worklets support
config.resolver.alias = {
  ...config.resolver.alias,
};

module.exports = config;