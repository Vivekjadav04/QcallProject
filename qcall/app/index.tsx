import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkPermissionsAndRoute();
  }, []);

  const checkPermissionsAndRoute = async () => {
    if (Platform.OS === 'android') {
      // 1. SILENT CHECK: We do NOT ask for permissions here.
      // We only check if they are already granted.
      try {
        const hasCallLog = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
        const hasContacts = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);

        // 2. ROUTING LOGIC
        if (hasCallLog && hasContacts) {
          // User has basics -> Go to App
          router.replace('/(tabs)');
        } else {
          // User missing basics -> Go to Welcome Screen
          router.replace('/welcome');
        }
      } catch (e) {
        // Fallback safety -> Go to Welcome
        router.replace('/welcome');
      }
    } else {
      // iOS / Web Fallback
      router.replace('/(tabs)');
    }
  };

  return null; // No UI prevents "White Screen" flash or flickering
}