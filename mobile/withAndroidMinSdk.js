const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidMinSdk(config) {
  return withAppBuildGradle(config, (config) => {
    // Ensure minSdkVersion is set to 26
    config.modResults.contents = config.modResults.contents.replace(
      /minSdk\s*=\s*\d+/g,
      'minSdk = 26'
    );
    config.modResults.contents = config.modResults.contents.replace(
      /minSdkVersion\s*=?\s*\d+/g,
      'minSdkVersion 26'
    );
    
    return config;
  });
};