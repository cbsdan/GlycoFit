const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidMinSdk(config) {
  return withAppBuildGradle(config, (config) => {
    // Ensure minSdkVersion is set to 28 (required for Health Connect)
    config.modResults.contents = config.modResults.contents.replace(
      /minSdk\s*=\s*\d+/g,
      'minSdk = 28'
    );
    config.modResults.contents = config.modResults.contents.replace(
      /minSdkVersion\s*=?\s*\d+/g,
      'minSdkVersion 28'
    );
    
    return config;
  });
};