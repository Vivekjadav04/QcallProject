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

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    if (!CallManagerModule) return;

    /**
     * 🟢 AUTO-RESTART & ROLE SYNC
     * When the Native side recreates the React Context after a role change,
     * this effect runs to ensure the JS thread catches up.
     */
    const syncAppState = async () => {
      try {
        // 1. Check if we are now the default dialer
        const isDefault = await CallManagerModule.checkIsDefaultDialer();
        
        if (isDefault) {
          console.log("App Active as Default Dialer. Checking for pending actions...");
          
          // 2. Trigger any pending calls stored in the 'DirectCall' vault
          if (DirectCall?.processPendingCall) {
            DirectCall.processPendingCall();
          }
        }
      } catch (e) {
        console.warn("App Restart Sync Failed:", e);
      }
    };

    /**
     * 🟢 PROFESSIONAL STATE LISTENER
     * Listens for the 'Disconnected' signal from Kotlin.
     * Prevents the app from closing by replacing the route with the Main Tabs.
     */
    const subscription = callEventEmitter.addListener('onCallStateChanged', (event: { status: string }) => {
      console.log('Bridge Event Received:', event.status);

      if (event.status === 'Disconnected' || event.status === 'Idle') {
        // FIX: Clean absolute path without trailing slash
        router.replace('/(tabs)');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });

    /**
     * 🟢 COLD START SYNC
     * If the app is launched directly via a system call event.
     */
    const checkInitialCall = async () => {
      try {
        const currentCall = await CallManagerModule.getCurrentCallStatus();
        if (currentCall && currentCall.status === 'Incoming') {
          // FIX: Use clean absolute path
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
        tabBarStyle: { 
          height: Platform.OS === 'ios' ? 85 : 60 + insets.bottom, 
          paddingBottom: Platform.OS === 'ios' ? 25 : insets.bottom + 5,
          paddingTop: 10,
          backgroundColor: COLORS.background,
          borderTopWidth: 0, 
          elevation: 10, 
          shadowColor: COLORS.shadow, 
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
          fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
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
    textShadowColor: 'rgba(0, 86, 210, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 4
  }
});