import { useEffect, useState } from 'react';
import { AppState, NativeModules, Platform, NativeEventEmitter, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts & Services
import { UserProvider } from '../context/UserContext'; 
import { ContactProvider } from '../context/ContactContext'; 
import { SyncService } from '../services/SyncService'; 

// 🟢 1. IMPORT YOUR NEW NOTIFICATION COMPONENT
import IncomingCallNotification from '../components/IncomingCallNotification';

const { CallManagerModule } = NativeModules;

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments(); 

  // 🟢 2. ADD STATE TO CONTROL THE NOTIFICATION
  const [incomingCall, setIncomingCall] = useState<{ number: string, name: string } | null>(null);

  useEffect(() => {
    if (!CallManagerModule) {
        console.warn("⚠️ CallManagerModule not linked.");
        return;
    }

    const eventEmitter = new NativeEventEmitter(CallManagerModule);
    
    const subscription = eventEmitter.addListener('onCallStateChanged', (data) => {
      handleCallEvent(data);
    });

    const checkStatus = async () => {
      if (Platform.OS === 'android' && CallManagerModule?.getActiveCallInfo) {
        try {
          const data = await CallManagerModule.getActiveCallInfo();
          if (data) handleCallEvent(data);
        } catch (e) { console.warn(e); }
      }
    };

    checkStatus();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkStatus();
    });

    return () => {
      if (subscription) subscription.remove();
      appStateSub.remove();
    };
  }, [segments]); 

  const handleCallEvent = (data: any) => {
      console.log("⚡ Call Event:", data.status);
      
      if (data.status === 'Incoming') {
        // 🟢 3. SHOW NOTIFICATION INSTEAD OF NAVIGATING
        setIncomingCall({ 
          number: data.number, 
          name: data.name || 'Unknown' 
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } 
      else if (data.status === 'Active' || data.status === 'Dialing') {
        // 🟢 4. HIDE NOTIFICATION ON ANSWER
        setIncomingCall(null);
        
        // Navigate to Outgoing/Active screen
        const currentRoute = segments.length > 0 ? segments[segments.length - 1] : 'unknown';
        if (currentRoute !== 'outgoing') {
            router.replace({
                pathname: '/outgoing',
                params: { number: data.number, name: data.name || 'Unknown', status: data.status }
            });
        }
      }
      else if (data.status === 'Disconnected') {
        // 🟢 5. HIDE NOTIFICATION ON HANGUP
        setIncomingCall(null);
        if (router.canDismiss()) router.dismissAll();
        router.replace('/(tabs)');
      }
  };

  // 🟢 6. BUTTON HANDLERS
  const handleAccept = () => {
    CallManagerModule.answerCall();
    setIncomingCall(null);
  };

  const handleDecline = () => {
    CallManagerModule.endCall();
    setIncomingCall(null);
  };

  return (
    <UserProvider>
      <ContactProvider> 
        <SafeAreaProvider>
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="outgoing" options={{ presentation: 'fullScreenModal' }}/>
              {/* We don't need 'incoming' screen anymore */}
            </Stack>

            {/* 🟢 7. RENDER THE NOTIFICATION COMPONENT ON TOP */}
            <IncomingCallNotification 
              visible={!!incomingCall}
              callerName={incomingCall?.name || 'Unknown'}
              phoneNumber={incomingCall?.number || ''}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />

          </View>
        </SafeAreaProvider>
      </ContactProvider>
    </UserProvider>
  );
}