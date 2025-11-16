import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
      icon: 'checkmark-circle',
    },
    ERROR: {
      backgroundColor: colors.toast.error,
      icon: 'close-circle',
    },
    INFO: {
      backgroundColor: colors.toast.info,
      icon: 'information-circle',
    },
    WARNING: {
      backgroundColor: colors.toast.warning,
      icon: 'warning',
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
      <View style={styles.content}>
        <Ionicons 
          name={toastTypeProps.icon} 
          size={24} 
          color={colors.toast.text}
          style={styles.icon}
        />
        <Text style={[styles.message, { color: colors.toast.text }]} numberOfLines={3}>
          {message}
        </Text>
        <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={colors.toast.text} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// Container to manage multiple toasts
export const ToastContainer = ({ toasts, position = 'top' }) => {
  return (
    <View style={[styles.toastContainer, position === 'top' ? styles.topContainer : styles.bottomContainer]}>
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
  toastContainer: {
    position: 'absolute',
    width: '100%',
    zIndex: 9999,
    paddingHorizontal: 16,
  },
  topContainer: {
    top: 50,
  },
  bottomContainer: {
    bottom: 50,
  },
  container: {
    width: width - 32,
    borderRadius: 12,
    marginVertical: 5,
  },
  topPosition: {
    alignSelf: 'center',
  },
  bottomPosition: {
    alignSelf: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default Toast;
