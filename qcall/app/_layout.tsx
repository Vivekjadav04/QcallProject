import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { THEME } from '../constants/theme'; 

// 🟢 1. REDUX IMPORTS
import { Provider } from 'react-redux';
import { store } from '../store';
import { useAuth } from '../hooks/useAuth'; // Replaces useUser

// 🟢 2. INNER COMPONENT (The Logic)
// This must be a CHILD of the Provider so it can use hooks
function AppContent() {
  const { isAuthenticated, loading } = useAuth(); // 🟢 Uses Redux
  const router = useRouter();
  const segments = useSegments();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auth Guard Logic
  useEffect(() => {
    if (loading || !isMounted) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'otp';

    if (!isAuthenticated && !inAuthGroup) {
      // Not logged in -> Go to Login
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Logged in -> Go to Home
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, loading, segments, isMounted]);

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

      {/* Loading Overlay prevents flickering while checking auth */}
      {(loading || !isMounted) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      )}
    </View>
  );
}

// 🟢 3. ROOT EXPORT
// Wraps everything in Redux Provider FIRST
export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(THEME.colors.bg);
      NavigationBar.setButtonStyleAsync("dark");
    }
  }, []);

  return (
    <Provider store={store}> 
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: THEME.colors.bg }}>
          <StatusBar style="dark" backgroundColor={THEME.colors.bg} />
          {/* AppContent is inside Provider, so useAuth works! */}
          <AppContent />
        </View>
      </SafeAreaProvider>
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