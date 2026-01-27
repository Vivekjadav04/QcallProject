import React, { useEffect, useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Platform, PermissionsAndroid, NativeModules, ActivityIndicator, AppState 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🟢 IMPORT CUSTOM ALERT HOOK
import { useCustomAlert } from '../context/AlertContext';

const { CallManagerModule } = NativeModules;

export default function WelcomeScreen() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const appState = useRef(AppState.currentState);

  const { showAlert } = useCustomAlert();

  // 🟢 INTELLIGENT LISTENER: Detects when user returns from Settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active' && 
        isProcessing
      ) {
        console.log("App active, checking permissions...");
        // ⚡ Give a small delay for OS to update state
        setTimeout(() => checkPermissionsSequence(), 500);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isProcessing]);

  // 🟢 MAIN SEQUENCE: The "Waterfall" of permissions
  const checkPermissionsSequence = async () => {
    try {
      if (Platform.OS !== 'android') {
        await completeOnboarding();
        return;
      }

      // STEP 1: CHECK OVERLAY PERMISSION
      const hasOverlay = await CallManagerModule.checkOverlayPermission();
      if (!hasOverlay) {
         showAlert(
            "Display Permission Needed", 
            "To show the Caller ID popup, QCall needs permission to 'Display over other apps'. Tap OK to open Settings.", 
            "warning", 
            () => {
               // Open Settings
               CallManagerModule.requestOverlayPermission();
            }
         );
         return; // Stop here, wait for user to come back (useEffect will trigger this function again)
      }

      // STEP 2: CHECK DEFAULT DIALER
      const isDefault = await CallManagerModule.checkIsDefaultDialer();
      if (!isDefault) {
          // Request Dialer
          await CallManagerModule.requestDefaultDialer();
          return; // Wait for system dialog result or AppState return
      }

      // STEP 3: ALL GOOD -> FINISH
      await completeOnboarding();

    } catch (e) {
      console.error("Permission Sequence Error:", e);
      setIsProcessing(false);
    }
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('has_completed_onboarding', 'true');
    router.replace('/(tabs)');
  };

  const handleAgreeAndContinue = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // 🟢 PHASE 1: Standard Permissions (Popup style)
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
          PermissionsAndroid.PERMISSIONS.WRITE_CALL_LOG,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.CALL_PHONE,
          PermissionsAndroid.PERMISSIONS.ANSWER_PHONE_CALLS,
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS,
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          PermissionsAndroid.PERMISSIONS.SEND_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
        ];

        // Android 13+ Notification Permission
        if (Platform.Version >= 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        // Basic check if critical ones are denied
        const criticalDenied = 
             granted[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] !== PermissionsAndroid.RESULTS.GRANTED ||
             granted[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] !== PermissionsAndroid.RESULTS.GRANTED;

        if (criticalDenied) {
           showAlert("Permission Required", "We need basic access to Calls and Contacts to function.", "error");
           setIsProcessing(false);
           return;
        }
      }

      // 🟢 PHASE 2: Expo Contacts
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setIsProcessing(false);
        return;
      }

      // 🟢 PHASE 3: Trigger the Advanced Check (Overlay + Dialer)
      checkPermissionsSequence();

    } catch (e) {
      console.error("Onboarding Error:", e);
      setIsProcessing(false);
      showAlert("Error", "An unexpected error occurred.", "error");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.headerTitle}>Permissions & Privacy</Text>
        <Text style={styles.subHeader}>
          To provide Caller ID and Spam protection, QCall needs the following permissions.
        </Text>

        <View style={styles.divider} />

        {/* --- PERMISSIONS LIST --- */}
        <View style={styles.sectionHeaderRow}>
            <Feather name="check-circle" size={20} color="#007AFF" /> 
            <Text style={styles.sectionHeaderTitle}>Required Permissions</Text>
        </View>

        {/* 1. Calls */}
        <View style={styles.itemContainer}>
            <View style={styles.iconRow}>
                <Ionicons name="call" size={24} color="#007AFF" />
                <Text style={styles.itemTitle}>Calls & Log</Text>
            </View>
            <Text style={styles.itemDesc}>To identify incoming numbers and manage your history.</Text>
        </View>

        {/* 2. Overlay (NEW) */}
        <View style={styles.itemContainer}>
            <View style={styles.iconRow}>
                <MaterialIcons name="layers" size={24} color="#007AFF" />
                <Text style={styles.itemTitle}>Display Over Apps</Text>
            </View>
            <Text style={styles.itemDesc}>Required to show the Caller ID popup when your phone rings.</Text>
        </View>

        {/* 3. Contacts */}
        <View style={styles.itemContainer}>
            <View style={styles.iconRow}>
                <MaterialIcons name="contacts" size={24} color="#007AFF" />
                <Text style={styles.itemTitle}>Contacts</Text>
            </View>
            <Text style={styles.itemDesc}>To match incoming calls with your saved friends.</Text>
        </View>

        {/* 4. Messages */}
        <View style={styles.itemContainer}>
            <View style={styles.iconRow}>
                <MaterialIcons name="message" size={24} color="#007AFF" />
                <Text style={styles.itemTitle}>Messages</Text>
            </View>
            <Text style={styles.itemDesc}>To handle spam SMS and quick replies.</Text>
        </View>

      </ScrollView>

      {/* --- FOOTER --- */}
      <View style={styles.footer}>
        <View style={styles.lockRow}>
            <Feather name="lock" size={12} color="#64748B" />
            <Text style={styles.footerText}>
                Your data stays private. By continuing you agree to our {'\n'}
                <Text style={styles.linkText}>Privacy Policy</Text> and <Text style={styles.linkText}>Terms of Service</Text>
            </Text>
        </View>

        <TouchableOpacity 
            style={[styles.btn, isProcessing && styles.btnDisabled]} 
            onPress={handleAgreeAndContinue}
            disabled={isProcessing}
            activeOpacity={0.8}
        >
            {isProcessing ? (
                <ActivityIndicator color="#FFF" />
            ) : (
                <Text style={styles.btnText}>AGREE & CONTINUE</Text>
            )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
  
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  subHeader: { fontSize: 14, color: '#64748B', lineHeight: 20, marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 20 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginLeft: 8 },

  itemContainer: { marginBottom: 24 },
  iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginLeft: 12 },
  itemDesc: { fontSize: 13, color: '#475569', lineHeight: 20, paddingLeft: 36 },

  footer: { 
    padding: 24, 
    borderTopWidth: 1, 
    borderColor: '#E2E8F0', 
    backgroundColor: '#FFF'
  },
  lockRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  footerText: { fontSize: 11, color: '#64748B', marginLeft: 6, textAlign: 'center', lineHeight: 16 },
  linkText: { color: '#007AFF', fontWeight: '600' },

  btn: { 
    backgroundColor: '#16A34A',
    paddingVertical: 14, 
    borderRadius: 30, 
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4
  },
  btnDisabled: { backgroundColor: '#86EFAC' },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
});