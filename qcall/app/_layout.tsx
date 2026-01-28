import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { THEME } from '../constants/theme'; 
import axios from 'axios'; 
import { API_BASE_URL } from '../constants/config'; 

// 🟢 1. CONTEXT IMPORTS (Redux Removed)
import { AuthProvider, useAuth } from '../hooks/useAuth'; // New Context Hook
import { AlertProvider } from '../context/AlertContext'; 
import CustomAlert from '../components/CustomAlert'; 

// 🟢 2. INNER COMPONENT (The Logic)
function AppContent() {
  // 🟢 Updated Hook Usage: We check if 'user' exists to know if authenticated
  const { user, loading: authLoading } = useAuth(); 
  const isAuthenticated = !!user; // Derived state

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
      // Simple Ping to see if backend is alive
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
    // Wait until everything is ready
    if (authLoading || !isMounted || !isServerReady) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'otp';

    if (!isAuthenticated && !inAuthGroup) {
      // If not logged in and trying to access protected routes -> Go to Login
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // If logged in and trying to access login page -> Go to Tabs
      router.replace('/welcome');
    }
  }, [isAuthenticated, authLoading, segments, isMounted, isServerReady]);

  // Loading State: Show if Auth is loading OR Server Check is running
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

// 🟢 3. ROOT EXPORT
export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(THEME.colors.bg);
      NavigationBar.setButtonStyleAsync("dark");
    }
  }, []);

  return (
    // 🟢 WRAPPED WITH AUTH PROVIDER
    <AlertProvider> 
      <AuthProvider>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: THEME.colors.bg }}>
            <StatusBar style="dark" backgroundColor={THEME.colors.bg} />
            <AppContent />
          </View>
        </SafeAreaProvider>
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