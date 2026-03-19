export default ({ config }) => {
  return {
    ...config,
    name: "GlycoFit Physician",
    slug: "physician",
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
      package: "com.glycofit4444.physician",
      // This is the logic that makes it work:
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "@react-native-firebase/app",
      [
        "expo-build-properties",
        {
          "android": {
            "compileSdkVersion": 35,
            "targetSdkVersion": 35,
            "buildToolsVersion": "35.0.0",
            "androidGradlePluginVersion": "8.7.3",
            "kotlinVersion": "2.0.21"
          }
        }
      ]
    ],
    extra: {
      EXPO_PUBLIC_FIREBASE_API_KEY: "AIzaSyDcdJik9SmR2O_APNggZoV3EbCSrRxP3-c",
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "glycofit-c3e87.firebaseapp.com",
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: "glycofit-c3e87",
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "glycofit-c3e87.firebasestorage.app",
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "528174172461",
      EXPO_PUBLIC_FIREBASE_APP_ID: "1:528174172461:web:a777eca8a61634c7296ba4",
      eas: {
        projectId: "b7a83a28-0268-42bc-aa1f-084d8abd18cf"
      }
    }
  };
};