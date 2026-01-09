import { useEffect } from 'react';
import { AppState, NativeModules, Platform, NativeEventEmitter } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts & Services
import { UserProvider } from '../context/UserContext'; 
import { ContactProvider } from '../context/ContactContext'; 
import { SyncService } from '../services/SyncService'; 

const { CallManagerModule } = NativeModules;

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments(); 

  // 🟢 1. GLOBAL CALL HANDLING
  useEffect(() => {
    if (!CallManagerModule) {
        console.warn("⚠️ CallManagerModule not linked. Skipping native listeners.");
        return;
    }

    const eventEmitter = new NativeEventEmitter(CallManagerModule);
    
    // LISTENER: Handles events while app is OPEN
    const subscription = eventEmitter.addListener('onCallStateChanged', (data) => {
      handleCallEvent(data);
    });

    // CHECKER: Handles events when app OPENS/RESUMES
    const checkStatus = async () => {
      if (Platform.OS === 'android' && CallManagerModule?.getActiveCallInfo) {
        try {
          const data = await CallManagerModule.getActiveCallInfo();
          if (data && (data.status === 'Incoming' || data.status === 'Active' || data.status === 'Dialing')) {
             handleCallEvent(data);
          }
        } catch (e) {
          console.warn("Sync failed:", e);
        }
      }
    };

    checkStatus();

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

  // 🟢 HELPER: Handle Navigation & State
  const handleCallEvent = (data: any) => {
      console.log("⚡ Call Event Detected:", data.status);
      
      const currentRoute = segments.length > 0 ? segments[segments.length - 1] : 'unknown';

      // CASE 1: INCOMING CALL
      if (data.status === 'Incoming') {
        if (currentRoute !== 'incoming') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.push({ 
            pathname: '/incoming', 
            params: { number: data.number, name: data.name || 'Unknown' } 
          });
        }
      } 
      
      // CASE 2: ACTIVE CALL (Answered)
      // This fixes the "Ghost UI" by forcibly replacing the incoming screen
      else if (data.status === 'Active' || data.status === 'Dialing') {
        if (currentRoute !== 'outgoing') {
          console.log("📞 Redirecting to Outgoing Screen...");
          
          // Use REPLACE to kill the Incoming modal if it's open
          router.replace({
            pathname: '/outgoing',
            params: { number: data.number, name: data.name || 'Unknown', status: data.status }
          });
        }
      }

      // CASE 3: DISCONNECTED (Call Ended)
      // This ensures the screen closes if the other person hangs up
      else if (data.status === 'Disconnected') {
        if (currentRoute === 'incoming' || currentRoute === 'outgoing') {
           console.log("📴 Call Ended. Returning to home.");
           // Dismiss triggers the unmount of the screen, which should stop the Ringtone (if handled in useEffect cleanup)
           if (router.canDismiss()) {
             router.dismissAll();
           }
           router.replace('/'); 
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
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="otp" />
            <Stack.Screen name="register" />
            <Stack.Screen name="(tabs)" />
            
            {/* Call Screens */}
            <Stack.Screen 
              name="incoming" 
              options={{ 
                presentation: 'transparentModal', 
                gestureEnabled: false,
                animation: 'none' 
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