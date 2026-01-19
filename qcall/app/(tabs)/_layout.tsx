import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { NativeModules, NativeEventEmitter } from 'react-native';
import * as Haptics from 'expo-haptics';

// 🟢 IMPORT THE CUSTOM TAB BAR
import CustomTabBar from '../../components/CustomTabBar';

const { CallManagerModule, DirectCall } = NativeModules;
const callEventEmitter = new NativeEventEmitter(CallManagerModule);

export default function TabLayout() {
  const router = useRouter();

  useEffect(() => {
    if (!CallManagerModule) return;

    const syncAppState = async () => {
      try {
        const isDefault = await CallManagerModule.checkIsDefaultDialer();
        if (isDefault && DirectCall?.processPendingCall) {
          DirectCall.processPendingCall();
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
          // Note: Since we use native UI now, we technically don't need to push to a route, 
          // but keeping this doesn't hurt.
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
      // 🟢 HOOK UP THE CUSTOM TAB BAR HERE
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ 
        headerShown: false, 
        tabBarHideOnKeyboard: true,
        // This ensures the content doesn't get hidden behind the floating bar
        tabBarStyle: { position: 'absolute' }, 
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Recents' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts' }} />
      <Tabs.Screen name="assist" options={{ title: 'Assist' }} />
      <Tabs.Screen name="upgrade" options={{ title: 'Premium' }} />
    </Tabs>
  );
}