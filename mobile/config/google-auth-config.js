// Configuration for Google Authentication

// Project specific client IDs from the BMW project google-services.json
// Use the web client ID from google-services.json (client_type 3)
export const WEB_CLIENT_ID = "528174172461-7kgul1oc8tb0t5jfrbu1bh2v5p5a1d7g.apps.googleusercontent.com";

// Configuration for @react-native-google-signin/google-signin
export const GOOGLE_SIGNIN_CONFIG = {
  scopes: ['profile', 'email'],
  webClientId: WEB_CLIENT_ID,
  offlineAccess: true,
};
