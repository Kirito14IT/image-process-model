// Prevent autolinking of JS-only polyfills that don't require native Android code
// react-native-get-random-values provides a JS polyfill and does not need native linking.
module.exports = {
  dependencies: {
    'react-native-get-random-values': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};

