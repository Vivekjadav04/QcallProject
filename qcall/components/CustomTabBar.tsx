import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme'; // 🟢 FIXED: Lowercase 'theme'

export default function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.container, 
      { bottom: Platform.OS === 'ios' ? insets.bottom + 10 : 25 } 
    ]}>
      <BlurView intensity={90} tint="light" style={styles.blurContainer}>
        <View style={styles.tabRow}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate(route.name);
              }
            };

            let icon: any;
            const color = isFocused ? THEME.colors.primary : THEME.colors.textSub;
            const size = 24;

            if (route.name === 'index') icon = <Ionicons name={isFocused ? "time" : "time-outline"} size={size} color={color} />;
            else if (route.name === 'messages') icon = <Feather name="message-circle" size={size} color={color} />;
            else if (route.name === 'contacts') icon = <Feather name="users" size={size} color={color} />;
            else if (route.name === 'assist') icon = <MaterialCommunityIcons name={isFocused ? "robot" : "robot-outline"} size={26} color={color} />;
            else if (route.name === 'upgrade') icon = <MaterialCommunityIcons name={isFocused ? "crown" : "crown-outline"} size={26} color={color} />;

            return (
              <TouchableOpacity
                key={index}
                accessibilityRole="button"
                onPress={onPress}
                style={styles.tabItem}
                activeOpacity={0.7}
              >
                {isFocused && <View style={styles.activeBackground} />}
                <View style={{ zIndex: 2 }}>{icon}</View>
                {isFocused && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 30,
    overflow: 'hidden',
    ...THEME.shadows.floating,
  },
  blurContainer: {
    paddingVertical: 12,
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.90)' : 'transparent',
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    width: 50,
  },
  activeBackground: {
    position: 'absolute',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: THEME.colors.primaryLight,
    opacity: 0.6,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.primary,
    position: 'absolute',
    bottom: 6,
  }
});