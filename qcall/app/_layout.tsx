import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Contexts
import { UserProvider } from '../context/UserContext'; 
import { ContactProvider } from '../context/ContactContext'; 

export default function RootLayout() {

  return (
    <UserProvider>
      <ContactProvider> 
        <SafeAreaProvider>
          <View style={{ flex: 1 }}>
            <StatusBar style="dark" />
            {/* We removed 'outgoing' and 'incoming' from the Stack.
                The Native Android Activity now handles all call screens.
            */}
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </View>
        </SafeAreaProvider>
      </ContactProvider>
    </UserProvider>
  );
}