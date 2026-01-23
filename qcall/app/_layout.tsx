import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { THEME } from '../constants/theme'; 
import axios from 'axios'; 
import { API_BASE_URL } from '../constants/config'; 

// 🟢 1. REDUX & CONTEXT IMPORTS
import { Provider } from 'react-redux';
import { store } from '../store';
import { useAuth } from '../hooks/useAuth';
import CustomAlert from '../components/CustomAlert'; 
import { AlertProvider } from '../context/AlertContext'; // 🟢 IMPORTED PROVIDER

// 🟢 2. INNER COMPONENT (The Logic)
function AppContent() {
  const { isAuthenticated, loading: authLoading } = useAuth(); 
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
      router.replace('/(tabs)');
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
      </Stack>

      {/* 🟢 A. The Gatekeeper Alert (Blocks Interaction) */}
      <CustomAlert 
        visible={showServerAlert}
        type="error"
        title="Connection Failed"
        message="We cannot reach the Qcall servers. Please check your internet or try again."
        actionText="Retry Connection"
        onAction={checkServerHealth} 
      />

      {/* 🟢 B. Loading Overlay */}
      {showLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      )}
    </View>
  );
}

// 🟢 3. ROOT EXPORT (WRAPPED WITH ALERT PROVIDER)
export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(THEME.colors.bg);
      NavigationBar.setButtonStyleAsync("dark");
    }
  }, []);

  return (
    <Provider store={store}> 
      {/* 🟢 WRAPPED HERE: Now every screen has access to showAlert() */}
      <AlertProvider> 
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: THEME.colors.bg }}>
            <StatusBar style="dark" backgroundColor={THEME.colors.bg} />
            <AppContent />
          </View>
        </SafeAreaProvider>
      </AlertProvider>
    </Provider>
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