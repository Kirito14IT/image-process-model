const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to enable cleartext traffic for Android
 */
const withCleartextTraffic = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    if (!manifest.application) {
      return config;
    }

    const application = manifest.application[0];
    if (!application.$) {
      application.$ = {};
    }

    // Set usesCleartextTraffic to true
    application.$['android:usesCleartextTraffic'] = 'true';

    return config;
  });
};

module.exports = withCleartextTraffic;

