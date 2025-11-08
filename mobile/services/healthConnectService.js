import { Platform } from 'react-native';
import {
  initialize,
  getSdkStatus,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
  openHealthConnectSettings,
} from 'react-native-health-connect';

// Define all available Health Connect record types
export const HealthRecordTypes = {
  // Activity & Exercise
  STEPS: 'Steps',
  DISTANCE: 'Distance',
  ACTIVE_CALORIES_BURNED: 'ActiveCaloriesBurned',
  TOTAL_CALORIES_BURNED: 'TotalCaloriesBurned',
  EXERCISE_SESSION: 'ExerciseSession',
  
  // Body Measurements
  WEIGHT: 'Weight',
  HEIGHT: 'Height',
  BODY_FAT: 'BodyFat',
  
  // Vitals
  HEART_RATE: 'HeartRate',
  BLOOD_PRESSURE: 'BloodPressure',
  BLOOD_GLUCOSE: 'BloodGlucose',
  BODY_TEMPERATURE: 'BodyTemperature',
  OXYGEN_SATURATION: 'OxygenSaturation',
  RESTING_HEART_RATE: 'RestingHeartRate',
  
  // Sleep
  SLEEP_SESSION: 'SleepSession',
  
  // Nutrition
  NUTRITION: 'Nutrition',
  HYDRATION: 'Hydration',
};

// Health Connect Manager using actual react-native-health-connect library
class HealthConnectManager {
  constructor() {
    this.isAndroid = Platform.OS === 'android';
    this.isInitialized = false;
    this.sdkStatus = null;
  }

  // Initialize Health Connect
  async initialize() {
    console.log('🔧 Initializing Health Connect Manager...');
    
    if (!this.isAndroid) {
      const error = new Error('Health Connect is only available on Android');
      error.code = 'PLATFORM_NOT_SUPPORTED';
      throw error;
    }

    try {
      // Check if device meets minimum requirements (API 28+)
      if (Platform.Version < 28) {
        const error = new Error('Health Connect requires Android 9.0 (API 28) or higher. Your device is running Android API ' + Platform.Version);
        error.code = 'MIN_API_NOT_MET';
        throw error;
      }

      // Check SDK status first
      this.sdkStatus = await getSdkStatus();
      console.log('📊 SDK Status before initialization:', this.sdkStatus);
      
      // Handle different SDK statuses
      if (this.sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        const error = new Error('Health Connect is not installed on this device');
        error.code = 'NOT_INSTALLED';
        error.suggestion = 'Please install Health Connect from the Google Play Store';
        error.playStoreUrl = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
        throw error;
      }
      
      if (this.sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        const error = new Error('Health Connect needs to be updated');
        error.code = 'UPDATE_REQUIRED';
        error.suggestion = 'Please update Health Connect from the Google Play Store';
        error.playStoreUrl = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
        throw error;
      }

      const isInitialized = await initialize();
      this.isInitialized = isInitialized;
      
      console.log('✅ Health Connect Manager initialized');
      console.log('📊 SDK Status:', this.sdkStatus);
      
      return isInitialized;
    } catch (error) {
      console.error('❌ Failed to initialize Health Connect:', error);
      
      // Add helpful information to service unavailable errors
      if (error.message.includes('Service not available') || error.message.includes('not available')) {
        error.code = error.code || 'SERVICE_UNAVAILABLE';
        error.suggestion = error.suggestion || 'Health Connect may not be installed. Please install it from the Google Play Store';
        error.playStoreUrl = error.playStoreUrl || 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
      }
      
      throw error;
    }
  }

  // Check SDK availability
  async getSdkStatus() {
    console.log('📊 Checking Health Connect SDK status...');
    
    if (!this.isAndroid) {
      return SdkAvailabilityStatus.SDK_UNAVAILABLE;
    }

    try {
      this.sdkStatus = await getSdkStatus();
      console.log('SDK Status:', this.sdkStatus);
      return this.sdkStatus;
    } catch (error) {
      console.error('Error checking SDK status:', error);
      return SdkAvailabilityStatus.SDK_UNAVAILABLE;
    }
  }

  // Request permissions for health data
  async requestPermission(permissions) {
    console.log('🔐 Requesting Health Connect permissions...');
    console.log('📋 Permissions array:', JSON.stringify(permissions, null, 2));
    console.log('📊 Current SDK Status:', this.sdkStatus);
    console.log('✅ Is Initialized:', this.isInitialized);
    
    if (!this.isInitialized) {
      throw new Error('Health Connect not initialized. Call initialize() first.');
    }

    // Allow permission requests even if SDK needs update
    // SDK_AVAILABLE = 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED = 3
    if (this.sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      throw new Error('Health Connect SDK is not available on this device');
    }

    try {
      console.log('📱 About to call requestPermission from react-native-health-connect...');
      const grantedPermissions = await requestPermission(permissions);
      console.log('✅ requestPermission completed. Type:', typeof grantedPermissions);
      console.log('✅ Granted permissions result:', JSON.stringify(grantedPermissions, null, 2));
      console.log('✅ Is Array:', Array.isArray(grantedPermissions));
      console.log('✅ Length:', grantedPermissions?.length);
      return grantedPermissions;
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  // Request all common health permissions
  async requestAllPermissions() {
    console.log('🔐 Requesting all health permissions...');
    
    const permissions = [
      // Activity
      { accessType: 'read', recordType: HealthRecordTypes.STEPS },
      { accessType: 'read', recordType: HealthRecordTypes.DISTANCE },
      { accessType: 'read', recordType: HealthRecordTypes.ACTIVE_CALORIES_BURNED },
      { accessType: 'read', recordType: HealthRecordTypes.TOTAL_CALORIES_BURNED },
      { accessType: 'read', recordType: HealthRecordTypes.EXERCISE_SESSION },
      
      // Body Measurements
      { accessType: 'read', recordType: HealthRecordTypes.WEIGHT },
      { accessType: 'read', recordType: HealthRecordTypes.HEIGHT },
      { accessType: 'read', recordType: HealthRecordTypes.BODY_FAT },
      
      // Vitals
      { accessType: 'read', recordType: HealthRecordTypes.HEART_RATE },
      { accessType: 'read', recordType: HealthRecordTypes.BLOOD_PRESSURE },
      { accessType: 'read', recordType: HealthRecordTypes.BLOOD_GLUCOSE },
      { accessType: 'read', recordType: HealthRecordTypes.OXYGEN_SATURATION },
      { accessType: 'read', recordType: HealthRecordTypes.RESTING_HEART_RATE },
      
      // Sleep
      { accessType: 'read', recordType: HealthRecordTypes.SLEEP_SESSION },
      
      // Nutrition
      { accessType: 'read', recordType: HealthRecordTypes.NUTRITION },
      { accessType: 'read', recordType: HealthRecordTypes.HYDRATION },
    ];

    return await this.requestPermission(permissions);
  }

  // Read health records
  async readRecords(recordType, options = {}) {
    console.log(`🔍 Reading ${recordType} records...`, options);
    
    if (!this.isInitialized) {
      throw new Error('Health Connect not initialized. Call initialize() first.');
    }

    try {
      // react-native-health-connect returns { records: [...] }
      const result = await readRecords(recordType, options);
      const records = result?.records || [];
      console.log(`📊 Found ${records.length} ${recordType} records`);
      return records;
    } catch (error) {
      console.error(`❌ Error reading ${recordType} records:`, error);
      throw error;
    }
  }

  // Get all health data for a date range
  async getAllHealthData(startDate, endDate) {
    console.log('📊 Fetching all health data...');
    
    const timeRangeFilter = {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    const allData = {};
    const recordTypes = Object.values(HealthRecordTypes);

    for (const recordType of recordTypes) {
      try {
        const records = await this.readRecords(recordType, { timeRangeFilter });
        if (records && records.length > 0) {
          allData[recordType] = records;
        }
      } catch (error) {
        console.warn(`⚠️ Could not read ${recordType}:`, error.message);
        // Continue with other record types even if one fails
      }
    }

    console.log('✅ All health data fetched:', Object.keys(allData));
    return allData;
  }

  // Get activity data (steps, distance, calories)
  async getActivityData(startDate, endDate) {
    console.log('🏃 Fetching activity data...');
    
    const timeRangeFilter = {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    const activityData = {
      steps: [],
      distance: [],
      activeCalories: [],
      totalCalories: [],
      exerciseSessions: [],
    };

    try {
      activityData.steps = await this.readRecords(HealthRecordTypes.STEPS, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read steps:', error.message);
    }

    try {
      activityData.distance = await this.readRecords(HealthRecordTypes.DISTANCE, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read distance:', error.message);
    }

    try {
      activityData.activeCalories = await this.readRecords(HealthRecordTypes.ACTIVE_CALORIES_BURNED, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read active calories:', error.message);
    }

    try {
      activityData.totalCalories = await this.readRecords(HealthRecordTypes.TOTAL_CALORIES_BURNED, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read total calories:', error.message);
    }

    try {
      activityData.exerciseSessions = await this.readRecords(HealthRecordTypes.EXERCISE_SESSION, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read exercise sessions:', error.message);
    }

    return activityData;
  }

  // Get vitals data (heart rate, blood pressure, etc.)
  async getVitalsData(startDate, endDate) {
    console.log('❤️ Fetching vitals data...');
    
    const timeRangeFilter = {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    const vitalsData = {
      heartRate: [],
      bloodPressure: [],
      bloodGlucose: [],
      oxygenSaturation: [],
      restingHeartRate: [],
    };

    try {
      vitalsData.heartRate = await this.readRecords(HealthRecordTypes.HEART_RATE, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read heart rate:', error.message);
    }

    try {
      vitalsData.bloodPressure = await this.readRecords(HealthRecordTypes.BLOOD_PRESSURE, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read blood pressure:', error.message);
    }

    try {
      vitalsData.bloodGlucose = await this.readRecords(HealthRecordTypes.BLOOD_GLUCOSE, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read blood glucose:', error.message);
    }

    try {
      vitalsData.oxygenSaturation = await this.readRecords(HealthRecordTypes.OXYGEN_SATURATION, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read oxygen saturation:', error.message);
    }

    try {
      vitalsData.restingHeartRate = await this.readRecords(HealthRecordTypes.RESTING_HEART_RATE, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read resting heart rate:', error.message);
    }

    return vitalsData;
  }

  // Get body measurements data
  async getBodyMeasurementsData(startDate, endDate) {
    console.log('📏 Fetching body measurements data...');
    
    const timeRangeFilter = {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    const bodyData = {
      weight: [],
      height: [],
      bodyFat: [],
    };

    try {
      bodyData.weight = await this.readRecords(HealthRecordTypes.WEIGHT, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read weight:', error.message);
    }

    try {
      bodyData.height = await this.readRecords(HealthRecordTypes.HEIGHT, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read height:', error.message);
    }

    try {
      bodyData.bodyFat = await this.readRecords(HealthRecordTypes.BODY_FAT, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read body fat:', error.message);
    }

    return bodyData;
  }

  // Get sleep data
  async getSleepData(startDate, endDate) {
    console.log('😴 Fetching sleep data...');
    
    const timeRangeFilter = {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    try {
      const sleepSessions = await this.readRecords(HealthRecordTypes.SLEEP_SESSION, { timeRangeFilter });
      return sleepSessions;
    } catch (error) {
      console.warn('Could not read sleep data:', error.message);
      return [];
    }
  }

  // Get nutrition data
  async getNutritionData(startDate, endDate) {
    console.log('🍎 Fetching nutrition data...');
    
    const timeRangeFilter = {
      operator: 'between',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    };

    const nutritionData = {
      nutrition: [],
      hydration: [],
    };

    try {
      nutritionData.nutrition = await this.readRecords(HealthRecordTypes.NUTRITION, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read nutrition:', error.message);
    }

    try {
      nutritionData.hydration = await this.readRecords(HealthRecordTypes.HYDRATION, { timeRangeFilter });
    } catch (error) {
      console.warn('Could not read hydration:', error.message);
    }

    return nutritionData;
  }

  // Get today's data
  async getTodayData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.getAllHealthData(today, tomorrow);
  }

  // Get this week's data
  async getThisWeekData() {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return await this.getAllHealthData(weekAgo, today);
  }

  // Get this month's data
  async getThisMonthData() {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return await this.getAllHealthData(monthAgo, today);
  }

  // Check if SDK is available
  isSdkAvailable() {
    return this.sdkStatus === SdkAvailabilityStatus.SDK_AVAILABLE;
  }

  // Get current SDK status
  getCurrentSdkStatus() {
    return this.sdkStatus;
  }

  // Get SDK status description
  getSdkStatusDescription() {
    switch (this.sdkStatus) {
      case SdkAvailabilityStatus.SDK_AVAILABLE:
        return 'Health Connect is available and ready to use';
      case SdkAvailabilityStatus.SDK_UNAVAILABLE:
        return 'Health Connect is not available on this device';
      case SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED:
        return 'Health Connect provider needs to be updated';
      case SdkAvailabilityStatus.SDK_UNAVAILABLE_NOT_SUPPORTED:
        return 'Health Connect is not supported on this device';
      default:
        return 'Unknown SDK status';
    }
  }
}

// Export singleton instance
const healthConnectManager = new HealthConnectManager();

// Export convenience functions
export const initializeHealthConnect = () => healthConnectManager.initialize();
export const getHealthConnectSdkStatus = () => healthConnectManager.getSdkStatus();
export const requestHealthPermission = (permissions) => healthConnectManager.requestPermission(permissions);
export const requestAllHealthPermissions = () => healthConnectManager.requestAllPermissions();
export const readHealthRecords = (recordType, options) => healthConnectManager.readRecords(recordType, options);
export const getAllHealthData = (startDate, endDate) => healthConnectManager.getAllHealthData(startDate, endDate);
export const getActivityData = (startDate, endDate) => healthConnectManager.getActivityData(startDate, endDate);
export const getVitalsData = (startDate, endDate) => healthConnectManager.getVitalsData(startDate, endDate);
export const getBodyMeasurementsData = (startDate, endDate) => healthConnectManager.getBodyMeasurementsData(startDate, endDate);
export const getSleepData = (startDate, endDate) => healthConnectManager.getSleepData(startDate, endDate);
export const getNutritionData = (startDate, endDate) => healthConnectManager.getNutritionData(startDate, endDate);
export const getTodayData = () => healthConnectManager.getTodayData();
export const getThisWeekData = () => healthConnectManager.getThisWeekData();
export const getThisMonthData = () => healthConnectManager.getThisMonthData();
export const openHealthConnectSettingsPage = () => openHealthConnectSettings();

// Re-export from library
export { SdkAvailabilityStatus };

// Export manager instance
export default healthConnectManager;