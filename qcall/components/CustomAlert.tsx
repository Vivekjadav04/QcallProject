import React, { useEffect, useRef } from 'react';
import { 
  Modal, View, Text, TouchableOpacity, StyleSheet, 
  Animated, Dimensions, Easing 
} from 'react-native';
import { BlurView } from 'expo-blur'; // Make sure expo-blur is installed
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface CustomAlertProps {
  visible: boolean;
  type?: 'error' | 'success' | 'warning';
  title: string;
  message: string;
  onAction: () => void;
  actionText?: string;
}

export default function CustomAlert({ 
  visible, 
  type = 'error', 
  title, 
  message, 
  onAction, 
  actionText = "Retry" 
}: CustomAlertProps) {
  
  // Animation Values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Colors based on type
  const colors = {
    error: { main: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
    success: { main: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)' },
    warning: { main: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' }
  };
  const theme = colors[type];

  // Run Animation when 'visible' changes
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.timing(scaleAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none">
      {/* 1. Blurred Background */}
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        
        {/* 2. Animated Alert Card */}
        <Animated.View style={[
          styles.alertCard, 
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim, borderColor: theme.main }
        ]}>
          
          {/* Icon Circle */}
          <View style={[styles.iconCircle, { backgroundColor: theme.bg }]}>
            <Ionicons 
              name={type === 'error' ? "cloud-offline" : type === 'success' ? "checkmark-circle" : "warning"} 
              size={32} 
              color={theme.main} 
            />
          </View>

          {/* Text Content */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {/* Action Button */}
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.main }]} 
            onPress={onAction}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{actionText}</Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', // Fallback if BlurView fails
  },
  alertCard: {
    width: width * 0.85,
    backgroundColor: '#1E293B', // Slate-900
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#94A3B8', // Slate-400
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});