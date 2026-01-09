import React, { useEffect } from 'react';
import { View, Text, StyleSheet, NativeModules, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking'; 
import { useUser } from '../context/UserContext';
import { useContacts } from '../context/ContactContext';

// 🟢 Access our Native Modules
const { DirectCall, CallManagerModule } = NativeModules;

export default function SplashScreen() {
  const router = useRouter();
  const { loadUser } = useUser();
  const { syncContacts } = useContacts();

  useEffect(() => {
    const checkLogin = async () => {
      try {
        // 1. Sync contacts in background
        syncContacts(); 

        // 2. CHECK FOR PENDING CALLS (Role Change Handoff)
        // If the app restarted because of a Default Dialer change, 
        // this tells Kotlin to dial the number now.
        if (Platform.OS === 'android' && DirectCall) {
            console.log("Checking for pending handoff calls...");
            DirectCall.processPendingCall(); 
        }

        const [userPhone, initialUrl] = await Promise.all([
          AsyncStorage.getItem('user_phone'),
          Linking.getInitialURL(),
          new Promise(resolve => setTimeout(resolve, 800)) 
        ]);

        // --- DEEP LINK LOGIC ---
        let deepLinkTarget = null;
        let deepLinkParams = null;
        
        if (initialUrl) {
          console.log("🚀 Cold Start URL:", initialUrl);
          if (initialUrl.includes('dial/')) {
             const parts = initialUrl.split('dial/');
             if (parts.length > 1) {
                const number = decodeURIComponent(parts[1]);
                deepLinkTarget = '/dial/[number]';
                deepLinkParams = { number };
             }
          } else {
             const { queryParams } = Linking.parse(initialUrl);
             if (queryParams?.number) {
                deepLinkTarget = '/dial/[number]';
                deepLinkParams = { number: queryParams.number };
             }
          }
        }

        // --- NAVIGATION LOGIC ---
        if (userPhone) {
          await loadUser();
          
          if (deepLinkTarget) {
            router.replace({ pathname: deepLinkTarget, params: deepLinkParams } as any);
          } else {
            router.replace('/(tabs)');
          }
        } else {
          router.replace('/login');
        }
      } catch (e) {
        console.error("Startup Error:", e);
        router.replace('/login');
      }
    };

    checkLogin();
  }, []);

  return (
    <View style={styles.container}>
      {/* ... rest of your UI remains exactly the same ... */}
      <View style={styles.centerContent}>
        <View style={styles.logoContainer}>
          <Text style={{ fontSize: 40 }}>📞</Text>
          <View style={styles.qBadge}>
            <Text style={styles.qText}>Q</Text>
          </View>
        </View>
        <Text style={styles.welcomeText}>Welcome To</Text>
        <Text style={styles.brandText}>QCALL</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.fromText}>From</Text>
        <View style={styles.rkContainer}>
          <View style={styles.rkLogo}><Text style={styles.rkLogoText}>R</Text></View>
          <View style={styles.kLogo}><Text style={styles.rkLogoText}>K</Text></View>
          <Text style={styles.rkGroupText}> GROUP</Text>
        </View>
      </View>
    </View>
  );
}

// ... styles remain the same ...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 60 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoContainer: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: '#0056D2', justifyContent: 'center', alignItems: 'center', marginBottom: 20, position: 'relative' },
  qBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#0056D2', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  qText: { color: '#0056D2', fontSize: 10, fontWeight: 'bold' },
  welcomeText: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 5 },
  brandText: { fontSize: 28, fontWeight: 'bold', color: '#0056D2' },
  footer: { alignItems: 'center', marginBottom: 20 },
  fromText: { fontSize: 12, color: '#666', marginBottom: 8 },
  rkContainer: { flexDirection: 'row', alignItems: 'center' },
  rkLogo: { marginRight: 2 },
  kLogo: { marginRight: 0 },
  rkLogoText: { fontSize: 20, fontWeight: '900', color: '#D32F2F' },
  rkGroupText: { fontSize: 18, fontWeight: 'bold', color: '#D32F2F' },
});