import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

class StepDetectionService {
  constructor() {
    this.subscription = null;
    this.isRunning = false;
    this.stepCount = 0;
    this.lastStepTime = 0;
    
    // Step detection parameters
    this.threshold = 1.3; // Acceleration threshold for step detection
    this.minStepInterval = 300; // Minimum time between steps (ms)
    this.stepHistory = [];
    this.windowSize = 10; // Number of samples to analyze
    
    // Peak detection
    this.lastPeak = 0;
    this.lastValue = 0;
    this.isPeakDetected = false;
    
    this.listeners = [];
  }

  // Initialize service
  async initialize() {
    try {
      // Load saved steps for today
      await this.loadTodaySteps();
      
      // Check if new day
      await this.checkNewDay();
      
      console.log('📱 Step Detection Service initialized');
      return true;
    } catch (error) {
      console.error('❌ Step Detection initialization error:', error);
      return false;
    }
  }

  // Start step detection
  start() {
    if (this.isRunning) {
      console.log('⚠️ Step detection already running');
      return;
    }

    try {
      // Set update interval (20 times per second)
      Accelerometer.setUpdateInterval(50);

      this.subscription = Accelerometer.addListener(accelerometerData => {
        this.processAccelerometerData(accelerometerData);
      });

      this.isRunning = true;
      console.log('✅ Step detection started');
    } catch (error) {
      console.error('❌ Failed to start step detection:', error);
    }
  }

  // Stop step detection
  stop() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isRunning = false;
    this.saveTodaySteps();
    console.log('⏹️ Step detection stopped');
  }

  // Process accelerometer data
  processAccelerometerData(data) {
    const { x, y, z } = data;
    
    // Calculate magnitude of acceleration
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    
    // Remove gravity (normalize)
    const normalizedMagnitude = Math.abs(magnitude - 1);
    
    // Add to history
    this.stepHistory.push(normalizedMagnitude);
    if (this.stepHistory.length > this.windowSize) {
      this.stepHistory.shift();
    }

    // Detect step using peak detection algorithm
    this.detectStep(normalizedMagnitude);
  }

  // Detect step using peak detection
  detectStep(currentValue) {
    const now = Date.now();
    
    // Check if enough time has passed since last step
    if (now - this.lastStepTime < this.minStepInterval) {
      this.lastValue = currentValue;
      return;
    }

    // Detect peak (local maximum)
    if (currentValue > this.threshold && 
        currentValue > this.lastValue && 
        !this.isPeakDetected) {
      this.isPeakDetected = true;
      this.lastPeak = currentValue;
    }
    
    // Detect valley after peak (step completion)
    if (this.isPeakDetected && 
        currentValue < this.lastPeak * 0.6) {
      this.registerStep();
      this.isPeakDetected = false;
      this.lastStepTime = now;
    }

    this.lastValue = currentValue;
  }

  // Register a detected step
  registerStep() {
    this.stepCount++;
    this.notifyListeners(this.stepCount);
    
    // Save periodically (every 10 steps)
    if (this.stepCount % 10 === 0) {
      this.saveTodaySteps();
    }
  }

  // Get current step count
  getStepCount() {
    return this.stepCount;
  }

  // Reset step count
  resetStepCount() {
    this.stepCount = 0;
    this.saveTodaySteps();
    this.notifyListeners(0);
  }

  // Add listener for step updates
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Notify all listeners
  notifyListeners(stepCount) {
    this.listeners.forEach(callback => {
      try {
        callback(stepCount);
      } catch (error) {
        console.error('❌ Listener error:', error);
      }
    });
  }

  // Save today's steps to storage
  async saveTodaySteps() {
    try {
      const today = new Date().toDateString();
      const data = {
        date: today,
        steps: this.stepCount,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem('today_steps', JSON.stringify(data));
    } catch (error) {
      console.error('❌ Failed to save steps:', error);
    }
  }

  // Load today's steps from storage
  async loadTodaySteps() {
    try {
      const data = await AsyncStorage.getItem('today_steps');
      if (data) {
        const parsed = JSON.parse(data);
        const today = new Date().toDateString();
        
        // Only load if it's the same day
        if (parsed.date === today) {
          this.stepCount = parsed.steps || 0;
          console.log(`📊 Loaded ${this.stepCount} steps from storage`);
        } else {
          this.stepCount = 0;
        }
      }
    } catch (error) {
      console.error('❌ Failed to load steps:', error);
      this.stepCount = 0;
    }
  }

  // Check if it's a new day and reset if needed
  async checkNewDay() {
    try {
      const lastDate = await AsyncStorage.getItem('last_step_date');
      const today = new Date().toDateString();
      
      if (lastDate !== today) {
        // New day - archive yesterday's data
        if (lastDate) {
          await this.archiveYesterdaySteps();
        }
        
        this.stepCount = 0;
        await AsyncStorage.setItem('last_step_date', today);
        console.log('🆕 New day detected - reset step count');
      }
    } catch (error) {
      console.error('❌ Failed to check new day:', error);
    }
  }

  // Archive yesterday's steps
  async archiveYesterdaySteps() {
    try {
      const data = await AsyncStorage.getItem('today_steps');
      if (data) {
        const parsed = JSON.parse(data);
        
        // Get step history
        const historyData = await AsyncStorage.getItem('step_history');
        const history = historyData ? JSON.parse(historyData) : [];
        
        // Add yesterday's data
        history.push(parsed);
        
        // Keep only last 30 days
        if (history.length > 30) {
          history.shift();
        }
        
        await AsyncStorage.setItem('step_history', JSON.stringify(history));
        console.log('📦 Archived yesterday steps:', parsed.steps);
      }
    } catch (error) {
      console.error('❌ Failed to archive steps:', error);
    }
  }

  // Get step history
  async getStepHistory(days = 7) {
    try {
      const historyData = await AsyncStorage.getItem('step_history');
      if (!historyData) return [];
      
      const history = JSON.parse(historyData);
      return history.slice(-days);
    } catch (error) {
      console.error('❌ Failed to get history:', error);
      return [];
    }
  }

  // Calculate distance from steps
  calculateDistance(steps, strideLength = 0.762) {
    // Default stride length: 76.2 cm (average)
    return steps * strideLength; // meters
  }

  // Calculate calories from steps
  calculateCalories(steps, weightKg = 70) {
    // Accurate estimation: ~0.04 calories per step for average person
    // Weight adjustment: lighter people burn slightly less, heavier burn slightly more
    const baseCaloriesPerStep = 0.04;
    const weightFactor = weightKg / 70; // Normalize to 70kg baseline
    return steps * baseCaloriesPerStep * weightFactor;
  }
}

// Export singleton instance
const stepDetectionService = new StepDetectionService();
export default stepDetectionService;