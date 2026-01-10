import React, { useState, useEffect } from 'react';
import { View, Text, NativeModules, NativeEventEmitter } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

// 🟢 SAFE MODULE ACCESS
const { CallManagerModule } = NativeModules;
const callEventEmitter = CallManagerModule ? new NativeEventEmitter(CallManagerModule) : null;

export default function OutgoingCallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState('Initializing...');

  // 1. TRIGGER CALL & CLOSE SELF
  useEffect(() => {
    const startAndRedirect = async () => {
        if (!CallManagerModule) return;

        try {
            // Check if a call is already running natively
            const data = await CallManagerModule.getActiveCallInfo();
            
            if (data.status === 'Active' || data.status === 'Dialing') {
                console.log("🔄 Native Screen is taking over. Closing React UI...");
                // 🟢 CLOSE THIS SCREEN IMMEDIATELY
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)');
                return;
            }

            // If no call exists, START IT
            if (params.number) {
                console.log("🚀 Starting Native Call to:", params.number);
                CallManagerModule.startCall(params.number as string);
                
                // 🟢 Give Native Service 500ms to launch the Blue Screen, then close this one
                setTimeout(() => {
                    if (router.canGoBack()) router.back();
                    else router.replace('/(tabs)');
                }, 500);
            }
        } catch (error) {
            console.error("Call Start Failed:", error);
            setStatus("Failed to Call");
        }
    };

    startAndRedirect();
  }, []);

  // 2. Fallback UI (User barely sees this)
  return (
    <View style={{ flex: 1, backgroundColor: '#0056D2', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>
        Launching Secure Call...
      </Text>
    </View>
  );
}