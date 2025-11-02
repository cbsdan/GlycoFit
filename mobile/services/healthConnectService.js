import {
  initialize,
  requestPermission,
  readRecords,
  insertRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

class HealthConnectService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Check if Health Connect is available on the device
   */
  async checkAvailability() {
    try {
      const status = await getSdkStatus();
      console.log('Health Connect SDK Status:', status);
      
      if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
        return { available: true, message: 'Health Connect is available' };
      } else if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        return { 
          available: false, 
          message: 'Health Connect is not installed. Please install it from the Play Store.' 
        };
      } else if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return { 
          available: false, 
          message: 'Health Connect needs to be updated.' 
        };
      }
      
      return { available: false, message: 'Health Connect status unknown' };
    } catch (error) {
      console.error('Error checking Health Connect availability:', error);
      return { available: false, message: error.message };
    }
  }

  /**
   * Initialize Health Connect
   */
  async initialize() {
    try {
      const isInitialized = await initialize();
      this.isInitialized = isInitialized;
      console.log('Health Connect initialized:', isInitialized);
      return isInitialized;
    } catch (error) {
      console.error('Error initializing Health Connect:', error);
      return false;
    }
  }

  /**
   * Request permissions for steps
   */
  async requestStepsPermissions() {
    try {
      const permissions = [
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'write', recordType: 'Steps' },
      ];

      const granted = await requestPermission(permissions);
      console.log('Steps permissions granted:', granted);
      return granted;
    } catch (error) {
      console.error('Error requesting steps permissions:', error);
      return false;
    }
  }

  /**
   * Read steps data for a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async readSteps(startDate, endDate) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const timeRangeFilter = {
        operator: 'between',
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      };

      const result = await readRecords('Steps', timeRangeFilter);
      console.log('Steps records read:', result);
      
      // Calculate total steps
      const totalSteps = result.records.reduce((sum, record) => {
        return sum + (record.count || 0);
      }, 0);

      return {
        success: true,
        totalSteps,
        records: result.records,
      };
    } catch (error) {
      console.error('Error reading steps:', error);
      return {
        success: false,
        error: error.message,
        totalSteps: 0,
        records: [],
      };
    }
  }

  /**
   * Get today's steps
   */
  async getTodaySteps() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    return await this.readSteps(startOfDay, endOfDay);
  }

  /**
   * Get steps for the last 7 days
   */
  async getWeekSteps() {
    const now = new Date();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startOfWeek.setHours(0, 0, 0, 0);
    
    return await this.readSteps(startOfWeek, now);
  }

  /**
   * Write steps data (for manual entry)
   * @param {number} stepCount - Number of steps
   * @param {Date} startTime - Start time of the activity
   * @param {Date} endTime - End time of the activity
   */
  async writeSteps(stepCount, startTime, endTime) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const record = {
        recordType: 'Steps',
        count: stepCount,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };

      const result = await insertRecords([record]);
      console.log('Steps written:', result);
      
      return {
        success: true,
        recordIds: result,
      };
    } catch (error) {
      console.error('Error writing steps:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get steps grouped by day
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getStepsByDay(startDate, endDate) {
    try {
      const result = await this.readSteps(startDate, endDate);
      
      if (!result.success) {
        return result;
      }

      // Group records by day
      const stepsByDay = {};
      
      result.records.forEach(record => {
        const date = new Date(record.startTime);
        const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!stepsByDay[dayKey]) {
          stepsByDay[dayKey] = {
            date: dayKey,
            totalSteps: 0,
            records: [],
          };
        }
        
        stepsByDay[dayKey].totalSteps += record.count || 0;
        stepsByDay[dayKey].records.push(record);
      });

      // Convert to array and sort by date
      const dailyData = Object.values(stepsByDay).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      return {
        success: true,
        dailyData,
        totalSteps: result.totalSteps,
      };
    } catch (error) {
      console.error('Error getting steps by day:', error);
      return {
        success: false,
        error: error.message,
        dailyData: [],
        totalSteps: 0,
      };
    }
  }
}

export default new HealthConnectService();