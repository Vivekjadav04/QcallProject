import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { THEME } from '../constants/theme'; 
import axios from 'axios'; 
import { API_BASE_URL } from '../constants/config'; 

// 🟢 1. CONTEXT IMPORTS
import { AuthProvider, useAuth } from '../hooks/useAuth'; 
import { AlertProvider } from '../context/AlertContext'; 
import { ContactProvider } from '../context/ContactContext'; // 🟢 NEW
import { SecureOperationsProvider } from '../context/SecureOperationsContext'; // 🟢 NEW

import CustomAlert from '../components/CustomAlert'; 

// 🟢 2. INNER COMPONENT (The Logic)
function AppContent() {
  const { user, loading: authLoading } = useAuth(); 
  const isAuthenticated = !!user; 

  const router = useRouter();
  const segments = useSegments();
  const [isMounted, setIsMounted] = useState(false);

  // 🛡️ Server Health State
  const [isServerReady, setServerReady] = useState(false);
  const [isCheckingServer, setCheckingServer] = useState(true);
  const [showServerAlert, setShowServerAlert] = useState(false);

  // 1. Mount Check
  useEffect(() => {
    setIsMounted(true);
    checkServerHealth(); 
  }, []);

  // 2. The Server Health Check Function
  const checkServerHealth = async () => {
    setCheckingServer(true);
    setShowServerAlert(false);

    try {
      console.log(`[Health Gate] Pinging: ${API_BASE_URL}`);
      await axios.get(API_BASE_URL, { timeout: 4000 });
      console.log("[Health Gate] Server is Online 🟢");
      setServerReady(true);
    } catch (error) {
      console.error("[Health Gate] Server Unreachable 🔴", error);
      setServerReady(false);
      setShowServerAlert(true); 
    } finally {
      setCheckingServer(false);
    }
  };

  // 3. Auth Guard Logic
  useEffect(() => {
    if (authLoading || !isMounted || !isServerReady) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'otp';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/welcome');
    }
  }, [isAuthenticated, authLoading, segments, isMounted, isServerReady]);

  const showLoading = (authLoading || !isMounted || isCheckingServer) && !showServerAlert;

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.bg }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="caller-id/view-profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="caller-id/block-number" options={{ presentation: 'modal' }} />
        <Stack.Screen name="caller-id/spam-report" options={{ presentation: 'modal' }} />
      </Stack>

      <CustomAlert 
        visible={showServerAlert}
        type="error"
        title="Connection Failed"
        message="We cannot reach the Qcall servers. Please check your internet or try again."
        actionText="Retry Connection"
        onAction={checkServerHealth} 
      />

      {showLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      )}
    </View>
  );
}

// 🟢 3. ROOT EXPORT
export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(THEME.colors.bg);
      NavigationBar.setButtonStyleAsync("dark");
    }
  }, []);

  return (
    // 🟢 PROVIDER TREE: Alert -> Auth -> Contact -> SecureOps
    <AlertProvider> 
      <AuthProvider>
        <ContactProvider>
          <SecureOperationsProvider>
            <SafeAreaProvider>
              <View style={{ flex: 1, backgroundColor: THEME.colors.bg }}>
                <StatusBar style="dark" backgroundColor={THEME.colors.bg} />
                <AppContent />
              </View>
            </SafeAreaProvider>
          </SecureOperationsProvider>
        </ContactProvider>
      </AuthProvider>
    </AlertProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.colors.bg,
    zIndex: 999, 
    justifyContent: 'center',
    alignItems: 'center',
  }
});