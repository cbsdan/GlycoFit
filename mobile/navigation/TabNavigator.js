import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import MeasureScreen from '../screens/MeasureScreen';
import PredictionScreen from '../screens/PredictionScreen';
import FindPhysicianScreen from '../screens/FindPhysicianScreen';
import SettingsScreen from '../screens/SettingsScreen';
import StepCounterScreen from '../screens/StepCounterScreen';
import FoodScannerScreen from '../screens/FoodScannerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SmokingIntakeScreen from '../screens/SmokingIntakeScreen';
import AlcoholIntakeScreen from '../screens/AlcoholIntakeScreen';
import SleepTrackingScreen from '../screens/SleepTrackingScreen';
import SleepBaselineScreen from '../screens/SleepBaselineScreen';
import SleepDailyLogScreen from '../screens/SleepDailyLogScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Tracker Stack Navigator - handles navigation within Tracker tab
const MeasureStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MeasureMain" component={MeasureScreen} />
      <Stack.Screen name="StepCounter" component={StepCounterScreen} />
      <Stack.Screen name="FoodScanner" component={FoodScannerScreen} />
      <Stack.Screen name="SmokingIntake" component={SmokingIntakeScreen} />
      <Stack.Screen name="AlcoholIntake" component={AlcoholIntakeScreen} />
      <Stack.Screen name="SleepTracking" component={SleepTrackingScreen} />
      <Stack.Screen name="SleepBaseline" component={SleepBaselineScreen} />
      <Stack.Screen name="SleepDailyLog" component={SleepDailyLogScreen} />
    </Stack.Navigator>
  );
};

// Settings Stack Navigator - handles navigation to HealthData from Settings
const SettingsStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
};

const TabNavigator = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Tracker') {
            iconName = focused ? 'heart-pulse' : 'heart-pulse';
          } else if (route.name === 'FindPhysician') {
            iconName = focused ? 'doctor' : 'doctor';
          } else if (route.name === 'Assessment') {
            iconName = focused ? 'chart-line' : 'chart-line';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'cog' : 'cog-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: insets.bottom + 5,
          paddingTop: 5,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600',
          marginBottom: 5,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'Home',
        }}
      />
      <Tab.Screen 
        name="Tracker" 
        component={MeasureStack}
        options={{
          title: 'Tracker',
        }}
      />
      <Tab.Screen 
        name="FindPhysician" 
        component={FindPhysicianScreen}
        options={{
          title: 'Physician',
        }}
      />
      <Tab.Screen 
        name="Assessment" 
        component={PredictionScreen}
        options={{
          title: 'Assessment',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsStack}
        options={{
          title: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
