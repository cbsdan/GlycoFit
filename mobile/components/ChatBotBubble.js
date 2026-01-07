import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const ChatBotBubble = ({ onPress }) => {
  const { colors } = useTheme();
  const [scaleAnim] = useState(new Animated.Value(1));
  const [labelAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Continuous floating animation for the label
    Animated.loop(
      Animated.sequence([
        Animated.timing(labelAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(labelAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      zIndex: 1000,
      flexDirection: 'row',
      alignItems: 'center',
    },
    labelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 3,
    },
    label: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      opacity: 0.6,
    },
    labelText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    pointer: {
      width: 0,
      height: 0,
      borderTopWidth: 6,
      borderBottomWidth: 6,
      borderLeftWidth: 8,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: colors.primary,
      marginLeft: 2,
      marginRight: 0,
      opacity: 0.8,
    },
    bubble: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
    },
    pulseDot: {
      position: 'absolute',
      top: 45,
      right: 3,
      width: 14,
      height: 14,
      borderRadius: 6,
      backgroundColor: '#4CAF50',
      borderWidth: 2,
      borderColor: '#fff',
    },
  });

  const labelTranslateX = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.labelContainer,
          {
            transform: [{ translateX: labelTranslateX }],
          },
        ]}
      >
        <View style={styles.label}>
          <Text style={styles.labelText}>AI Health Assistant</Text>
        </View>
        <View style={styles.pointer} />
      </Animated.View>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.bubble}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
        >
          <Icon name="robot" size={30} color="#fff" />
          <View style={styles.pulseDot} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default ChatBotBubble;
