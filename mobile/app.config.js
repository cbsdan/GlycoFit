export default ({ config }) => {
  return {
    ...config,
    name: "GlycoFit",
    slug: "mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      package: "com.tupt.glycofit",
      // 🟢 CHANGE: Use environment variable from EAS Secret, fallback to local file
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      permissions: [
        "android.permission.health.READ_STEPS",
        "android.permission.health.WRITE_STEPS",
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
        "android.permission.health.READ_SLEEP"
      ],
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "74ce8e12-691f-4034-bb81-5c74d407f8a8"
      },
      EXPO_PUBLIC_FIREBASE_API_KEY: "AIzaSyDcdJik9SmR2O_APNggZoV3EbCSrRxP3-c",
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "glycofit-c3e87.firebaseapp.com",
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: "glycofit-c3e87",
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "glycofit-c3e87.firebasestorage.app",
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "528174172461",
      EXPO_PUBLIC_FIREBASE_APP_ID: "1:528174172461:web:a777eca8a61634c7296ba4"
    },
    plugins: [
      "./androidManifestPlugin.js",
      "@react-native-google-signin/google-signin",
      "react-native-health-connect",
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 28,
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: "35.0.0",
            kotlinVersion: "2.0.21"
          }
        }
      ],
      [
        "expo-secure-store",
        {
          requiredPermissions: [
            "READ_STEPS",
            "READ_DISTANCE",
            "READ_ACTIVE_CALORIES_BURNED"
          ]
        }
      ],
      "./withAndroidMinSdk.js"
    ]
  };
};