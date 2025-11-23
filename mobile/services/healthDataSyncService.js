import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  syncHealthData, 
  getLatestSyncTimestamps 
} from './api';

const LAST_SYNC_KEY = 'health_data_last_sync';
const AUTO_SYNC_ENABLED_KEY = 'health_data_auto_sync_enabled';

/**
 * Health Data Sync Service
 * Manages syncing of Health Connect data to backend
 */
class HealthDataSyncService {
  constructor() {
    this.isSyncing = false;
    this.autoSyncEnabled = true;
  }

  /**
   * Initialize sync service
   */
  async initialize() {
    try {
      const autoSyncEnabled = await AsyncStorage.getItem(AUTO_SYNC_ENABLED_KEY);
      this.autoSyncEnabled = autoSyncEnabled !== 'false';
      console.log('📊 Health Data Sync Service initialized. Auto-sync:', this.autoSyncEnabled);
    } catch (error) {
      console.error('Error initializing sync service:', error);
    }
  }

  /**
   * Enable or disable auto-sync
   */
  async setAutoSync(enabled) {
    try {
      this.autoSyncEnabled = enabled;
      await AsyncStorage.setItem(AUTO_SYNC_ENABLED_KEY, enabled.toString());
      console.log('📊 Auto-sync', enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Error setting auto-sync:', error);
    }
  }

  /**
   * Get auto-sync status
   */
  async isAutoSyncEnabled() {
    try {
      const autoSyncEnabled = await AsyncStorage.getItem(AUTO_SYNC_ENABLED_KEY);
      return autoSyncEnabled !== 'false';
    } catch (error) {
      console.error('Error getting auto-sync status:', error);
      return true;
    }
  }

  /**
   * Get last sync timestamp from local storage
   */
  async getLastSyncTime() {
    try {
      const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
      return lastSync ? JSON.parse(lastSync) : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Save sync timestamp to local storage
   */
  async saveLastSyncTime() {
    try {
      const syncTime = {
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleString(),
      };
      await AsyncStorage.setItem(LAST_SYNC_KEY, JSON.stringify(syncTime));
      return syncTime;
    } catch (error) {
      console.error('Error saving last sync time:', error);
    }
  }

  /**
   * Transform Health Connect data to backend format
   * Optimized to limit number of records per data type
   */
  transformHealthDataForSync(healthData) {
    const dataToSync = [];
    const MAX_RECORDS_PER_TYPE = 100; // Limit to prevent overwhelming the backend

    // Transform heart rate data (limit samples)
    if (healthData.vitals?.heartRate && Array.isArray(healthData.vitals.heartRate)) {
      let heartRateCount = 0;
      for (const record of healthData.vitals.heartRate) {
        if (heartRateCount >= MAX_RECORDS_PER_TYPE) break;
        
        if (record.samples && Array.isArray(record.samples)) {
          for (const sample of record.samples) {
            if (heartRateCount >= MAX_RECORDS_PER_TYPE) break;
            
            if (sample.beatsPerMinute && sample.time) {
              // Validate data before adding
              const bpm = Number(sample.beatsPerMinute);
              if (!isNaN(bpm) && bpm > 0 && bpm < 300) {  // Reasonable heart rate range
                dataToSync.push({
                  data_type: 'heart_rate',
                  value: bpm,
                  unit: 'bpm',
                  timestamp: sample.time,
                  metadata: {
                    source: 'health_connect',
                  },
                });
                heartRateCount++;
              }
            }
          }
        }
      }
    }

    // Transform active calories data (limit records)
    if (healthData.activity?.activeCalories && Array.isArray(healthData.activity.activeCalories)) {
      const caloriesRecords = healthData.activity.activeCalories.slice(0, MAX_RECORDS_PER_TYPE);
      caloriesRecords.forEach(record => {
        if (record.energy?.inKilocalories && record.startTime) {
          // Validate calories value
          const calories = Number(record.energy.inKilocalories);
          if (!isNaN(calories) && calories > 0 && calories < 10000) {  // Reasonable calorie range
            dataToSync.push({
              data_type: 'active_calories',
              value: calories,
              unit: 'kcal',
              timestamp: record.startTime,
              metadata: {
                source: 'health_connect',
                end_time: record.endTime || null,
              },
            });
          }
        }
      });
    }

    // Transform exercise data (limit records)
    if (healthData.activity?.exerciseSessions && Array.isArray(healthData.activity.exerciseSessions)) {
      const exerciseRecords = healthData.activity.exerciseSessions.slice(0, MAX_RECORDS_PER_TYPE);
      exerciseRecords.forEach(record => {
        if (record.startTime && record.endTime) {
          const durationMinutes = (new Date(record.endTime) - new Date(record.startTime)) / (1000 * 60);
          
          // Validate exercise duration (between 1 min and 24 hours)
          if (!isNaN(durationMinutes) && durationMinutes > 0 && durationMinutes < 1440) {
            dataToSync.push({
              data_type: 'exercise',
              value: Math.round(durationMinutes),
              unit: 'minutes',
              timestamp: record.startTime,
              metadata: {
                source: 'health_connect',
                exercise_type: record.exerciseType || 'unknown',
                end_time: record.endTime,
                title: record.title || null,
              },
            });
          }
        }
      });
    }

    // Transform sleep data (limit records)
    if (healthData.sleep && Array.isArray(healthData.sleep)) {
      const sleepRecords = healthData.sleep.slice(0, MAX_RECORDS_PER_TYPE);
      sleepRecords.forEach(record => {
        if (record.startTime && record.endTime) {
          const durationMinutes = (new Date(record.endTime) - new Date(record.startTime)) / (1000 * 60);
          
          // Validate sleep duration (between 1 min and 24 hours)
          if (!isNaN(durationMinutes) && durationMinutes > 0 && durationMinutes < 1440) {
            dataToSync.push({
              data_type: 'sleep',
              value: Math.round(durationMinutes),
              unit: 'minutes',
              timestamp: record.startTime,
              metadata: {
                source: 'health_connect',
                end_time: record.endTime,
                title: record.title || null,
                notes: record.notes || null,
              },
            });
          }
        }
      });
    }

    return dataToSync;
  }

  /**
   * Filter out already synced data based on backend timestamps
   */
  async filterNewData(dataToSync) {
    try {
      // Get latest sync timestamps from backend
      const latestSyncs = await getLatestSyncTimestamps();
      
      if (!latestSyncs?.latest_syncs) {
        return dataToSync; // If no previous syncs, sync all data
      }

      const { latest_syncs } = latestSyncs;

      // Filter out data that's already been synced
      const newData = dataToSync.filter(record => {
        const latestSync = latest_syncs[record.data_type];
        
        if (!latestSync) {
          return true; // No previous sync for this data type, include it
        }

        // Only include records with timestamps after the latest sync
        const recordTime = new Date(record.timestamp);
        const lastSyncTime = new Date(latestSync);
        
        return recordTime > lastSyncTime;
      });

      console.log(`📊 Filtered ${dataToSync.length - newData.length} already synced records`);
      return newData;
    } catch (error) {
      console.error('Error filtering new data:', error);
      // If error, sync all data to be safe
      return dataToSync;
    }
  }

  /**
   * Sync health data to backend
   */
  async syncData(healthData) {
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress, skipping...');
      return { success: false, message: 'Sync already in progress' };
    }

    try {
      this.isSyncing = true;
      console.log('🔄 Starting health data sync...');

      // Transform data to backend format
      const dataToSync = this.transformHealthDataForSync(healthData);
      
      if (dataToSync.length === 0) {
        console.log('ℹ️ No health data to sync');
        return { 
          success: true, 
          message: 'No data to sync',
          total_records: 0,
          inserted_count: 0,
          skipped_count: 0,
        };
      }

      console.log(`📤 Preparing to sync ${dataToSync.length} records`);

      // Filter out already synced data
      const newData = await this.filterNewData(dataToSync);

      if (newData.length === 0) {
        console.log('ℹ️ All data already synced');
        await this.saveLastSyncTime();
        return {
          success: true,
          message: 'All data already synced',
          total_records: dataToSync.length,
          inserted_count: 0,
          skipped_count: dataToSync.length,
        };
      }

      console.log(`📤 Syncing ${newData.length} new records...`);

      // Batch sync to prevent overwhelming the backend
      const BATCH_SIZE = 50;
      let totalInserted = 0;
      let totalSkipped = 0;
      
      for (let i = 0; i < newData.length; i += BATCH_SIZE) {
        const batch = newData.slice(i, i + BATCH_SIZE);
        console.log(`📤 Syncing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newData.length / BATCH_SIZE)}`);
        
        // Log first record of batch for debugging
        if (batch.length > 0) {
          console.log('📋 Sample record:', JSON.stringify(batch[0], null, 2));
        }
        
        const result = await syncHealthData(batch);
        
        if (!result.success) {
          console.error('❌ Batch sync failed:', result.error);
          throw new Error(result.error || 'Batch sync failed');
        }
        
        totalInserted += result.inserted_count || 0;
        totalSkipped += result.skipped_count || 0;
      }
      
      // Save last sync time
      await this.saveLastSyncTime();

      const finalResult = {
        success: true,
        message: 'Health data synced successfully',
        total_records: dataToSync.length,
        inserted_count: totalInserted,
        skipped_count: totalSkipped,
      };
      
      console.log('✅ Sync completed:', finalResult);
      return finalResult;
    } catch (error) {
      console.error('❌ Error syncing health data:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Check if sync is needed based on last sync time
   */
  async shouldSync() {
    try {
      const lastSync = await this.getLastSyncTime();
      
      if (!lastSync) {
        return true; // Never synced before
      }

      const lastSyncTime = new Date(lastSync.timestamp);
      const now = new Date();
      const hoursSinceLastSync = (now - lastSyncTime) / (1000 * 60 * 60);

      // Sync if more than 1 hour has passed
      return hoursSinceLastSync >= 1;
    } catch (error) {
      console.error('Error checking if sync needed:', error);
      return true; // Default to syncing if there's an error
    }
  }
}

// Export singleton instance
const healthDataSyncService = new HealthDataSyncService();

export default healthDataSyncService;
