module.exports = {
  expo: {
    name: "TezRide Partner",
    slug: "tez-ride-partner",
    version: "1.0.1",
    sdkVersion: "54.0.0",
    runtimeVersion: "1.0.1",
    updates: {
      enabled: true,
    },
    orientation: "portrait",
    cli: {
      appVersionSource: "remote",
    },
    icon: "./src/assets/logo.png",
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.tezride.partner",
      config: {
        googleMapsApiKey: "AIzaSyCIbaIdCvCWhGMU8ZvtxDF2DUMIkjYylmU",
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "TezRide needs your location to help you find nearby rides and navigate to pickup/dropoff points.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "TezRide needs your location in the background to keep receiving ride requests while you are online.",
        NSLocationAlwaysUsageDescription:
          "TezRide needs your location in the background to keep receiving ride requests while you are online.",
        UIBackgroundModes: ["location", "fetch", "remote-notification"],
        LSApplicationQueriesSchemes: ["comgooglemaps", "googlemaps", "waze"],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./src/assets/logo.png",
        backgroundColor: "#FF991C",
      },
      package: "com.tezride.partner",
      versionCode: 2,
      config: {
        googleMaps: {
          apiKey: "AIzaSyCIbaIdCvCWhGMU8ZvtxDF2DUMIkjYylmU",
        },
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "WAKE_LOCK",
        "VIBRATE",
        "POST_NOTIFICATIONS",
        "INTERNET",
        "ACCESS_NETWORK_STATE",
      ],
    },
    web: {
      favicon: "./src/assets/logo.png",
    },
    extra: {
      googleMapsApiKey: "AIzaSyCIbaIdCvCWhGMU8ZvtxDF2DUMIkjYylmU",
      eas: {
      },
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./src/assets/logo_customer.png",
          resizeMode: "contain",
          backgroundColor: "#FF5C00",
        },
      ],
      "expo-localization",
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.1.21",
            compileSdkVersion: 36,
            targetSdkVersion: 35,
            minSdkVersion: 24,
            manifestQueries: {
              intent: [
                {
                  action: "android.intent.action.VIEW",
                  data: { scheme: "google.navigation" },
                },
                {
                  action: "android.intent.action.VIEW",
                  data: { scheme: "geo" },
                },
                {
                  action: "android.intent.action.VIEW",
                  data: { scheme: "https", host: "www.google.com" },
                },
              ],
            },
          },
          ios: {
            deploymentTarget: "16.4",
          },
        },
      ],
      "expo-font",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow TezRide Partner to use your location.",
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
          foregroundService: {
            notificationTitle: "TezRide is tracking your location",
            notificationBody:
              "We use your location to find nearby rides and track your progress.",
            notificationColor: "#FF991C",
          },
        },
      ],
    ],
  },
};
