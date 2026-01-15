import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Platform, StyleSheet, NativeModules, NativeEventEmitter } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🟢 LINKING NATIVE MODULES
const { CallManagerModule, DirectCall } = NativeModules;
const callEventEmitter = new NativeEventEmitter(CallManagerModule);

const COLORS = {
  primary: '#0056D2',
  inactive: '#9CA3AF',
  background: '#FFFFFF',
  shadow: '#000000',
};

// 🟢 CONFIG: The height of the tab content itself (excluding the safe area)
const TAB_CONTENT_HEIGHT = 60; 

export default function TabLayout() {
  // 🟢 DYNAMIC INSETS: This reads the exact space needed for the Home Indicator (iOS) or Nav Bar (Android)
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    if (!CallManagerModule) return;

    const syncAppState = async () => {
      try {
        const isDefault = await CallManagerModule.checkIsDefaultDialer();
        if (isDefault) {
          if (DirectCall?.processPendingCall) {
            DirectCall.processPendingCall();
          }
        }
      } catch (e) {
        console.warn("App Restart Sync Failed:", e);
      }
    };

    const subscription = callEventEmitter.addListener('onCallStateChanged', (event: { status: string }) => {
      if (event.status === 'Disconnected' || event.status === 'Idle') {
        router.replace('/(tabs)');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });

    const checkInitialCall = async () => {
      try {
        const currentCall = await CallManagerModule.getCurrentCallStatus();
        if (currentCall && currentCall.status === 'Incoming') {
          router.push('../incoming');
        }
      } catch (e) {
        console.warn("Call Sync Failed:", e);
      }
    };
    
    syncAppState();
    checkInitialCall();

    return () => subscription.remove();
  }, []);

  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false, 
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarHideOnKeyboard: true, 
        
        // 🟢 UNIVERSAL LAYOUT LOGIC
        tabBarStyle: { 
          backgroundColor: COLORS.background,
          borderTopWidth: 0, 
          elevation: 20, 
          shadowColor: COLORS.shadow, 
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          
          // 1. DYNAMIC HEIGHT: Base content height + whatever the device needs at the bottom
          height: TAB_CONTENT_HEIGHT + insets.bottom,
          
          // 2. DYNAMIC PADDING: Pushes icons up so they don't touch the gesture bar
          // If insets.bottom is 0 (old Androids), we add 10px breathing room.
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          
          paddingTop: 10, // Space above icons
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
          marginBottom: 4, // Tiny visual tweak for label spacing
        }
      }}
    >
      <Tabs.Screen 
        name="index" 
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
        options={{
          title: 'Recents',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "call" : "call-outline"} size={26} color={color} style={focused ? styles.iconActive : null} />
          ),
        }} 
      />

      <Tabs.Screen 
        name="messages" 
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <Feather name="message-circle" size={26} color={color} style={focused ? styles.iconActive : null} />
          ),
        }} 
      />

      <Tabs.Screen 
        name="contacts" 
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color, focused }) => (
            <Feather name="users" size={26} color={color} style={focused ? styles.iconActive : null} />
          ),
        }} 
      />

      <Tabs.Screen 
        name="assist" 
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
        options={{
          title: 'Assist',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? "robot" : "robot-outline"} size={28} color={color} style={focused ? styles.iconActive : null} />
          ),
        }} 
      />

       <Tabs.Screen 
        name="upgrade" 
        listeners={{ tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
        options={{
          title: 'Premium',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? "crown" : "crown-outline"} size={28} color={color} style={focused ? styles.iconActive : null} />
          ),
        }} 
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconActive: {
    transform: [{ translateY: -2 }],
  }
});