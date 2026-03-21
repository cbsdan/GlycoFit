const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Custom config plugin to upgrade the Gradle wrapper version.
 *
 * React Native 0.81.5 uses AGP 8.11.0, which requires Gradle 8.13+. However,
 * the @react-native/gradle-plugin for 0.81.5 was built and tested against
 * Gradle 8.14.3. Using Gradle 8.13 (the expo SDK 54 default) causes a
 * "No variants exist" build failure for native library subprojects due to a
 * bug in that specific Gradle version when combined with AGP 8.11.0.
 *
 * This plugin updates gradle-wrapper.properties to Gradle 8.14.3 after
 * expo prebuild generates the android directory.
 */
module.exports = function withGradleWrapper(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const wrapperPath = path.join(
        config.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );

      if (fs.existsSync(wrapperPath)) {
        let contents = fs.readFileSync(wrapperPath, 'utf-8');
        contents = contents.replace(
          /distributionUrl=.*gradle-.*-bin\.zip/,
          'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip'
        );
        fs.writeFileSync(wrapperPath, contents);
      }

      return config;
    },
  ]);
};
