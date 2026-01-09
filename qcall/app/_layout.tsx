import { useEffect } from 'react';
import { AppState, NativeModules, Platform, NativeEventEmitter } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts & Services
import { UserProvider } from '../context/UserContext'; 
import { ContactProvider } from '../context/ContactContext'; 
import { SyncService } from '../services/SyncService'; 

// 🟢 SAFE MODULE ACCESS
const { CallManagerModule } = NativeModules;

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments(); 

  // 🟢 1. GLOBAL CALL HANDLING
  useEffect(() => {
    // 🟢 SAFEGUARD: Stop immediately if module is missing (prevents crash on old builds)
    if (!CallManagerModule) {
        console.warn("⚠️ CallManagerModule not linked. Skipping native listeners.");
        return;
    }

    const eventEmitter = new NativeEventEmitter(CallManagerModule);
    
    // LISTENER: Handles events while app is OPEN
    const subscription = eventEmitter.addListener('onCallStateChanged', (data) => {
      handleCallEvent(data);
    });

    // CHECKER: Handles events when app OPENS/RESUMES (e.g. tapping notification)
    const checkStatus = async () => {
      // 🟢 DEFENSIVE CHECK: Ensure method exists
      if (Platform.OS === 'android' && CallManagerModule?.getActiveCallInfo) {
        try {
          const data = await CallManagerModule.getActiveCallInfo();
          // Valid statuses to redirect: 'Incoming', 'Active', 'Dialing'
          if (data && (data.status === 'Incoming' || data.status === 'Active' || data.status === 'Dialing')) {
             handleCallEvent(data);
          }
        } catch (e) {
          console.warn("Sync failed:", e);
        }
      }
    };

    // Run check immediately on mount
    checkStatus();

    // Run check whenever app comes to foreground
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkStatus();
      }
    });

    return () => {
      if (subscription) subscription.remove();
      appStateSub.remove();
    };
  }, [segments]); 

  // 🟢 Helper to handle navigation safely
  const handleCallEvent = (data: any) => {
      console.log("⚡ Call Event Detected:", data.status);
      
      // Get current route safely
      const currentRoute = segments.length > 0 ? segments[segments.length - 1] : 'unknown';

      if (data.status === 'Incoming') {
        if (currentRoute !== 'incoming') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.push({ 
            pathname: '/incoming', 
            params: { number: data.number, name: data.name || 'Unknown' } 
          });
        }
      } 
      else if (data.status === 'Active' || data.status === 'Dialing') {
        // Redirect to outgoing if we aren't already there
        if (currentRoute !== 'outgoing') {
          console.log("📞 Redirecting to Outgoing Screen...");
          // Use replace to prevent back button from going back to 'Dialing' state
          router.replace({
            pathname: '/outgoing',
            params: { number: data.number, name: data.name || 'Unknown', status: data.status }
          });
        }
      }
  };

  // 🟢 2. DATA SYNC
  useEffect(() => {
    try {
        SyncService.startSync();
        const appStateSub = AppState.addEventListener('change', (nextState) => {
          if (nextState === 'active') SyncService.startSync();
        });
        return () => appStateSub.remove();
    } catch (err) {
        console.log("Sync Error:", err);
    }
  }, []);

  return (
    <UserProvider>
      <ContactProvider> 
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            {/* Main Application Flow */}
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="otp" />
            <Stack.Screen name="register" />
            <Stack.Screen name="(tabs)" />
            
            {/* Call Screens (Modals) */}
            <Stack.Screen 
              name="incoming" 
              options={{ 
                presentation: 'transparentModal', 
                gestureEnabled: false,
                animation: 'none' // Instant appearance for calls
              }} 
            />
            <Stack.Screen 
              name="outgoing" 
              options={{ 
                presentation: 'fullScreenModal', 
                gestureEnabled: false,
                animation: 'fade' 
              }}
            />
          </Stack>
        </SafeAreaProvider>
      </ContactProvider>
    </UserProvider>
  );
}