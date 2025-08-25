import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const Toast = ({ 
  visible, 
  type = 'INFO',
  message, 
  duration = 3000, 
  onHide,
  position = 'top'
}) => {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  
  const TOAST_TYPES = {
    SUCCESS: {
      backgroundColor: colors.toast.success,
      icon: 'check-circle',
    },
    ERROR: {
      backgroundColor: colors.toast.error,
      icon: 'exclamation-circle',
    },
    INFO: {
      backgroundColor: colors.toast.info,
      icon: 'info-circle',
    },
    WARNING: {
      backgroundColor: colors.toast.warning,
      icon: 'exclamation-triangle',
    },
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);
  
  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: position === 'top' ? -100 : 100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onHide) onHide();
    });
  };
  
  if (!visible) return null;
  
  const toastTypeProps = TOAST_TYPES[type.toUpperCase()] || TOAST_TYPES.INFO;
  
  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
          backgroundColor: toastTypeProps.backgroundColor,
          ...(position === 'top' ? styles.topPosition : styles.bottomPosition),
          ...colors.shadow
        }
      ]}
    >
      <FontAwesome name={toastTypeProps.icon} size={20} color={colors.toast.text} style={styles.icon} />
      <Text style={[styles.message, { color: colors.toast.text }]}>{message}</Text>
      <TouchableOpacity onPress={hideToast}>
        <FontAwesome name="times" size={18} color={colors.toast.text} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Container component
const ToastContainer = ({ 
  toasts,
  position = 'top'
}) => {
  if (!toasts || toasts.length === 0) return null;
  
  return (
    <View 
      style={[
        styles.containerWrapper,
        position === 'top' ? styles.topWrapper : styles.bottomWrapper
      ]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <Toast 
          key={toast.id} 
          visible={true}
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          onHide={() => toast.onHide(toast.id)}
          position={position}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  containerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  topWrapper: {
    top: 40,
  },
  bottomWrapper: {
    bottom: 40,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
    width: width - 40,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontWeight: '500',
    fontSize: 14,
  },
  topPosition: {},
  bottomPosition: {},
});

export { Toast, ToastContainer };
