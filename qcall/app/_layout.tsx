import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, ToastAndroid } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import notifee, { EventType } from '@notifee/react-native'; // 🟢 ADDED NOTIFEE FOR DEEP LINKING
import axios from 'axios'; 

import { THEME } from '../constants/theme'; 
import { API_BASE_URL } from '../constants/config'; 

// CONTEXT IMPORTS
import { AuthProvider, useAuth } from '../hooks/useAuth'; 
import { AlertProvider } from '../context/AlertContext'; 
import { ContactProvider } from '../context/ContactContext'; 
import { SecureOperationsProvider } from '../context/SecureOperationsContext'; 

function AppContent() {
  const { user, loading: authLoading } = useAuth(); 
  const isAuthenticated = !!user; 

  const router = useRouter();
  const segments = useSegments();
  const [isMounted, setIsMounted] = useState(false);
  const [isCheckingServer, setCheckingServer] = useState(true);

  // 1. Mount & Setup Deep Linking
  useEffect(() => {
    setIsMounted(true);
    checkServerHealth(); 

    // 🟢 DEEP LINKING: Listen for notification clicks globally
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification?.data?.senderId) {
        console.log("Notification tapped! Routing to chat:", detail.notification.data.senderId);
        router.push({
          pathname: '../messages/chat',
          params: { 
            senderId: String(detail.notification.data.senderId),
            senderName: String(detail.notification.data.senderName || ''),
            isBank: String(detail.notification.data.isBank || 'false')
          }
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 2. The Resilient Server Health Check
  const checkServerHealth = async () => {
    try {
      console.log(`[Health Gate] Pinging: ${API_BASE_URL}`);
      await axios.get(API_BASE_URL, { timeout: 4000 });
      console.log("[Health Gate] Server is Online 🟢");
    } catch (error) {
      console.error("[Health Gate] Server Unreachable 🔴", error);
      // 🟢 OFFLINE MODE: We don't block the app anymore. We just notify the user.
      if (Platform.OS === 'android') {
        ToastAndroid.show("Offline Mode: Basic call features available", ToastAndroid.LONG);
      }
    } finally {
      setCheckingServer(false);
    }
  };

  // 3. Auth Guard Logic (No longer blocked by server status)
  useEffect(() => {
    if (authLoading || !isMounted || isCheckingServer) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'otp';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // 🟢 PERMISSION TIMING: Only go to welcome AFTER login is done.
      router.replace('/welcome'); 
    }
  }, [isAuthenticated, authLoading, segments, isMounted, isCheckingServer]);

  // Only show loading while checking local auth state or initial server ping
  const showLoading = authLoading || !isMounted || isCheckingServer;

  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.bg }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="welcome" /> 
        <Stack.Screen name="chat" /> 
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="caller-id/view-profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="caller-id/block-number" options={{ presentation: 'modal' }} />
        <Stack.Screen name="caller-id/spam-report" options={{ presentation: 'modal' }} />
      </Stack>

      {/* 🟢 Removed the blocking CustomAlert so the app never gets stuck */}
      {showLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      )}
    </View>
  );
}

// ROOT EXPORT
export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(THEME.colors.bg);
      NavigationBar.setButtonStyleAsync("dark");
    }
  }, []);

  return (
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