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

  // 🟢 HOOK THE ALERT SYSTEM
  const { showAlert } = useCustomAlert();

  // 🟢 LISTENER: Detect when user returns from "Default Dialer" settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // If app comes from background -> active, and we were processing permissions...
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active' && 
        isProcessing
      ) {
        console.log("App active, checking dialer status...");
        checkDialerAndProceed();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isProcessing]);

  // 🟢 LOGIC: Checks if user actually set the default dialer
  const checkDialerAndProceed = async () => {
    try {
      if (Platform.OS === 'android' && CallManagerModule) {
        const isDefault = await CallManagerModule.checkIsDefaultDialer();
        if (isDefault) {
          // Success! They set it.
          await completeOnboarding();
        } else {
          // They came back but DID NOT set it.
          setIsProcessing(false);
          
          // 🟠 WARNING ALERT
          showAlert(
            "Setup Incomplete", 
            "QCall works best as your default phone app. Please try setting it again.", 
            "warning", 
            () => handleAgreeAndContinue() // Action: Retry
          );
        }
      } else {
        await completeOnboarding();
      }
    } catch (e) {
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
      // 1. 🟢 Request ALL Native Android Permissions (Updated with SMS)
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
          PermissionsAndroid.PERMISSIONS.WRITE_CALL_LOG,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.CALL_PHONE,
          PermissionsAndroid.PERMISSIONS.ANSWER_PHONE_CALLS,
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS,
          // 🟢 ADDED MESSAGE PERMISSIONS
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          PermissionsAndroid.PERMISSIONS.SEND_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
        ];

        // Android 13+ (API 33) requires explicit Notification permission
        if (Platform.Version >= 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        // Check critical permissions
        const callLogGranted = granted[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] === PermissionsAndroid.RESULTS.GRANTED;
        const phoneStateGranted = granted[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED;
        const contactsGranted = granted[PermissionsAndroid.PERMISSIONS.READ_CONTACTS] === PermissionsAndroid.RESULTS.GRANTED;
        const smsGranted = granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;

        if (!callLogGranted || !phoneStateGranted || !contactsGranted || !smsGranted) {
           // 🔴 ERROR ALERT
           showAlert("Permission Required", "We need access to Calls, Contacts, and Messages to function correctly.", "error");
           setIsProcessing(false);
           return;
        }
      }

      // 2. 🟢 Request Expo Contacts
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert("Permission Required", "We need contacts access to show caller names.", "error");
        setIsProcessing(false);
        return;
      }

      // 3. 🟢 Request Default Dialer
      if (Platform.OS === 'android' && CallManagerModule) {
        const isDefault = await CallManagerModule.checkIsDefaultDialer();
        if (!isDefault) {
           // Opens system dialog. The useEffect listener above waits for the return.
           await CallManagerModule.requestDefaultDialer();
           return; // Wait for listener
        }
      }

      // If already default, finish immediately
      await completeOnboarding();

    } catch (e) {
      console.error("Onboarding Error:", e);
      setIsProcessing(false);
      showAlert("Error", "An unexpected error occurred during setup.", "error");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.headerTitle}>Permissions and privacy</Text>
        <Text style={styles.subHeader}>
          Please review the key points in our Privacy policy and Terms of service below.
        </Text>

        <View style={styles.divider} />

        {/* --- PERMISSIONS HEADER --- */}
        <View style={styles.sectionHeaderRow}>
            <Feather name="check-circle" size={20} color="#007AFF" /> 
            <Text style={styles.sectionHeaderTitle}>Permissions</Text>
        </View>

        {/* --- CALLS --- */}
        <View style={styles.itemContainer}>
            <View style={styles.iconRow}>
                <Ionicons name="call" size={24} color="#007AFF" />
                <Text style={styles.itemTitle}>Calls & Notifications</Text>
            </View>
            <Text style={styles.itemDesc}>
                Required to make calls, show incoming call screens, and manage call history.
            </Text>
        </View>

        {/* --- CONTACTS --- */}
        <View style={styles.itemContainer}>
            <View style={styles.iconRow}>
                <MaterialIcons name="contacts" size={24} color="#007AFF" />
                <Text style={styles.itemTitle}>Contacts</Text>
            </View>
            <Text style={styles.itemDesc}>
                Required to identify caller names and show their photos.
            </Text>
        </View>

        {/* --- 🟢 MESSAGES (NEW) --- */}
        <View style={styles.itemContainer}>
            <View style={styles.iconRow}>
                <MaterialIcons name="message" size={24} color="#007AFF" />
                <Text style={styles.itemTitle}>Messages</Text>
            </View>
            <Text style={styles.itemDesc}>
                Required to send quick responses when you can't answer a call.
            </Text>
        </View>

        {/* --- DATA --- */}
        <View style={styles.itemContainer}>
            <View style={styles.iconRow}>
                <MaterialIcons name="security" size={24} color="#007AFF" />
                <Text style={styles.itemTitle}>Data we process</Text>
            </View>
            <Text style={styles.itemDesc}>
                We are committed to privacy. We only process data required for phone number, call logs, and spam detection.
            </Text>
        </View>

      </ScrollView>

      {/* --- FOOTER --- */}
      <View style={styles.footer}>
        <View style={styles.lockRow}>
            <Feather name="lock" size={12} color="#64748B" />
            <Text style={styles.footerText}>
                By clicking agree & continue you agree to our {'\n'}
                <Text style={styles.linkText}>Privacy policy</Text> and <Text style={styles.linkText}>Terms of service</Text>
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