import { useEffect, useState } from 'react';
import { Platform, Linking } from 'react-native';
import {
  initialize,
  requestPermission,
  getSdkStatus,
  SdkAvailabilityStatus,
  readRecords,
  openHealthConnectSettings,
} from 'react-native-health-connect';

const useHealthData = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [androidPermissions, setAndroidPermissions] = useState([]);
  const [error, setError] = useState(null);
  const [sdkStatus, setSdkStatus] = useState(null);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      initializeHealthConnect();
    } else {
      setError('Health Connect is only available on Android');
    }
  }, []);

  const initializeHealthConnect = async () => {
    try {
      console.log('Initializing Health Connect...');
      
      // Check SDK availability first
      const status = await getSdkStatus();
      setSdkStatus(status);
      console.log('Health Connect SDK Status:', status);

      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        setError('Health Connect is not available on this device. Please install it from Play Store.');
        return;
      }

      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        setError('Please update Health Connect app from Play Store');
        return;
      }

      // Initialize the SDK - Add delay to ensure native module is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const isInit = await initialize();
      console.log('Health Connect initialized:', isInit);
      
      if (isInit) {
        setIsInitialized(true);
        // Delay permission request to ensure initialization is complete
        setTimeout(() => {
          requestHealthPermissions();
        }, 1000);
      } else {
        setError('Failed to initialize Health Connect. Please restart the app.');
      }
    } catch (err) {
      console.error('Health Connect initialization error:', err);
      
      // Provide more specific error messages
      if (err.message.includes('lateinit')) {
        setError('Health Connect module not properly configured. The app needs to be rebuilt.');
      } else if (err.message.includes('not initialized')) {
        setError('Health Connect failed to initialize. Please restart the app.');
      } else {
        setError(err.message || 'Failed to initialize Health Connect');
      }
    }
  };

  const requestHealthPermissions = async () => {
    if (isRequestingPermissions) {
      console.log('Permission request already in progress');
      return;
    }

    try {
      setIsRequestingPermissions(true);
      
      const permissions = [
        { recordType: 'Steps', accessType: 'read' },
        { recordType: 'Distance', accessType: 'read' },
        { recordType: 'ActiveCaloriesBurned', accessType: 'read' },
      ];

      console.log('Requesting permissions:', permissions);
      
      // Add timeout for permission request
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Permission request timed out')), 30000)
      );
      
      const permissionPromise = requestPermission(permissions);
      const grantedPermissions = await Promise.race([permissionPromise, timeoutPromise]);
      
      console.log('Granted permissions:', grantedPermissions);
      setAndroidPermissions(grantedPermissions);
    } catch (err) {
      console.error('Permission request error:', err);
      
      if (err.message.includes('lateinit')) {
        setError('Critical Error: Health Connect permissions module not initialized. App rebuild required.');
      } else if (err.message.includes('timed out')) {
        setError('Permission request timed out. Please try again.');
      } else {
        setError(err.message || 'Failed to request permissions');
      }
    } finally {
      setIsRequestingPermissions(false);
    }
  };

  const readHealthRecords = async (recordType, timeRangeFilter) => {
    try {
      if (!isInitialized) {
        throw new Error('Health Connect not initialized');
      }

      const result = await readRecords(recordType, timeRangeFilter);
      return result;
    } catch (err) {
      console.error('Error reading health records:', err);
      throw err;
    }
  };

  const openHealthConnectApp = async () => {
    try {
      await openHealthConnectSettings();
    } catch (err) {
      console.error('Failed to open Health Connect:', err);
      // Fallback: try to open Play Store
      const playStoreUrl = 'market://details?id=com.google.android.apps.healthdata';
      const canOpen = await Linking.canOpenURL(playStoreUrl);
      if (canOpen) {
        await Linking.openURL(playStoreUrl);
      }
    }
  };

  return {
    isInitialized,
    androidPermissions,
    error,
    sdkStatus,
    isRequestingPermissions,
    readHealthRecords,
    requestHealthPermissions,
    openHealthConnectApp,
  };
};

export default useHealthData;