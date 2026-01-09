import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// 1. FIX: Import 'Colors' (not COLORS)
import { Colors } from '../constants/theme';

const { width } = Dimensions.get('window');

// 2. FIX: Create a shortcut variable called 'COLORS'
// We select the 'light' theme colors and add black/white manually since they might be missing
const COLORS = {
  ...Colors.light,
  white: '#FFFFFF',
  black: '#000000',
};

interface IncomingCallProps {
  callerName: string;
  phoneNumber: string;
  onAccept: () => void;
  onDecline: () => void;
  visible: boolean;
}

export default function IncomingCallNotification({ 
  callerName, 
  phoneNumber, 
  onAccept, 
  onDecline,
  visible 
}: IncomingCallProps) {

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        
        {/* Top Section: Icon & Text */}
        <View style={styles.headerContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="person" size={32} color={COLORS.primary} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Incoming Call...</Text>
            <Text style={styles.name}>{callerName}</Text>
            <Text style={styles.number}>{phoneNumber}</Text>
          </View>
        </View>

        {/* Bottom Section: Action Buttons */}
        <View style={styles.actionRow}>
          {/* Decline Button */}
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: COLORS.error }]} 
            onPress={onDecline}
          >
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>

          {/* Accept Button */}
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: COLORS.success }]} 
            onPress={onAccept}
          >
            <Ionicons name="call" size={28} color={COLORS.white} />
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 50, // Spacing from top of screen
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999, // Ensures it sits on top of everything
  },
  card: {
    width: width * 0.9, // 90% of screen width
    backgroundColor: COLORS.card, // #FFFFFF Pure White
    borderRadius: 24,
    padding: 20,
    // Modern Shadow
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.secondary, // Subtle Peach border
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.background, // #FFF5E9 Cream Background
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary, // #D66F2C Deep Orange
  },
  number: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 10,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  }
});