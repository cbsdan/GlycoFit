import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { globalStyles } from '../styles/globalStyles';

const LoadingScreen = () => {
  const { colors } = useTheme();

  return (
    <View style={[globalStyles.centeredContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[globalStyles.text, { color: colors.text, marginTop: 16 }]}>
        Loading...
      </Text>
    </View>
  );
};

export default LoadingScreen;
