import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, Animated, 
  NativeModules, NativeEventEmitter, Easing, Platform 
} from 'react-native';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CallService } from '../services/CallService'; 

// Safety Check
const { CallManagerModule } = NativeModules;
const callEventEmitter = CallManagerModule ? new NativeEventEmitter(CallManagerModule) : null;

const THEME = {
  colors: {
    primary: '#0056D2',
    danger: '#EF4444',   
    simBadge: 'rgba(0, 86, 210, 0.1)'
  }
};

export default function IncomingCallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const rawNumber = typeof params.number === 'string' ? params.number : 'Unknown';

  // SAFETY BUFFER: Prevents closing instantly on "ring start"
  const [canClose, setCanClose] = useState(false);

  const [info, setInfo] = useState({ 
    name: 'Identifying...', 
    number: rawNumber, 
    imageUri: null as string | null,
    isSpam: false, 
    sim: 'Jio 5G' 
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 🟢 1. THE BOUNCER CHECK (CRITICAL FIX)
  // This prevents the screen from showing if there is no actual call
  useEffect(() => {
    const validateCallSession = async () => {
        if (!CallManagerModule) return;

        try {
            const statusData = await CallManagerModule.getCurrentCallStatus();
            console.log("🔍 Call Status Check:", statusData.status);

            // If the system says "Idle" or "Disconnected", we shouldn't be here.
            // Navigate back to the main app immediately.
            if (statusData.status === 'Idle' || statusData.status === 'Disconnected') {
                console.log("🚫 No active call found. Redirecting to Home.");
                router.replace('/(tabs)');
            } 
            // If the call is already answered, go to the active screen
            else if (statusData.status === 'Active') {
                router.replace({ 
                    pathname: '/outgoing', 
                    params: { 
                        name: info.name,
                        number: info.number,
                        status: 'Active' 
                    } 
                });
            }
        } catch (error) {
            console.error("Call Check Failed:", error);
            // Safety fallback: If check fails, go home to prevent getting stuck
            router.replace('/(tabs)');
        }
    };

    // Run this check immediately when the screen mounts
    validateCallSession();

    // Also start the safety timer
    const timer = setTimeout(() => setCanClose(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // 2. Identify Caller
  useEffect(() => {
    let isMounted = true;
    const fetchIdentity = async () => {
        if (!rawNumber || rawNumber === 'Unknown') return;
        try {
            const identity = await CallService.identifyNumber(rawNumber);
            if (isMounted && identity) {
                setInfo(prev => ({
                    ...prev,
                    name: identity.name,
                    imageUri: identity.imageUri,
                    isSpam: identity.isSpam
                }));
            }
        } catch (e) { console.log("ID Failed", e); }
    };
    fetchIdentity();
    return () => { isMounted = false; };
  }, [rawNumber]);

  // 3. Listen to Call State Changes
  useEffect(() => {
    if (!callEventEmitter) return;

    const subscription = callEventEmitter.addListener('onCallStateChanged', (e: { status: string }) => {
        console.log("📞 Event:", e.status);

        if (e.status === 'Active') {
            router.replace({ 
                pathname: '/outgoing', 
                params: { 
                    name: info.name,
                    number: info.number,
                    imageUri: info.imageUri || '',
                    isSpam: info.isSpam ? 'true' : 'false',
                    status: 'Active' 
                } 
            });
        }
        
        if (e.status === 'Disconnected' || e.status === 'Idle') {
            if (canClose) {
                router.replace('/(tabs)');
            } else {
                console.log("⚠️ Call ended, but waiting for safety buffer...");
                // Force close after buffer anyway if call ended
                setTimeout(() => router.replace('/(tabs)'), 1000);
            }
        }
    });

    return () => subscription.remove();
  }, [info, canClose]);

  // Animation Loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
      ])
    ).start();
  }, []);

  const handleAnswer = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (CallManagerModule) CallManagerModule.answerCall();
  };

  const handleDecline = () => {
     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
     if (CallManagerModule) CallManagerModule.endCall(); 
     router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient 
        colors={info.isSpam ? ['#7F1D1D', '#450A0A', '#000'] : ['#E6F2FF', '#FFFFFF', '#F0F8FF']} 
        style={StyleSheet.absoluteFillObject} 
      />
      
      <SafeAreaView style={styles.content}>
        <View style={styles.topSection}>
          {info.isSpam ? (
            <View style={styles.spamBadge}>
               <MaterialIcons name="report-problem" size={16} color="#FFF" style={{marginRight: 6}} />
               <Text style={styles.spamBadgeText}>SCAM LIKELY</Text>
            </View>
          ) : (
            <View style={styles.simPill}>
               <Ionicons name="cellular" size={12} color={THEME.colors.primary} style={{marginRight: 6}} />
               <Text style={styles.simText}>Incoming via {info.sim}</Text>
            </View>
          )}
        </View>

        <View style={styles.profileSection}>
           <View style={styles.avatarContainer}>
              <Animated.View style={[
                  styles.pulseRing, 
                  { 
                    transform: [{ scale: pulseAnim }], 
                    borderColor: info.isSpam ? '#EF4444' : THEME.colors.primary 
                  }
              ]} />
              <Image 
                source={{ uri: info.imageUri || `https://ui-avatars.com/api/?background=${info.isSpam ? '991B1B' : '0056D2'}&color=fff&size=256&name=${info.name}` }} 
                style={[styles.avatar, info.isSpam && { borderColor: '#EF4444' }]} 
              />
           </View>
           
           <View style={styles.infoBox}>
             <Text style={[styles.nameText, info.isSpam && { color: '#FFF' }]} numberOfLines={1}>
                {info.name}
             </Text>
             <Text style={[styles.numberText, info.isSpam && { color: '#FECACA' }]}>
                {info.number}
             </Text>
           </View>
        </View>

        <View style={styles.bottomSection}>
           <BlurView intensity={info.isSpam ? 20 : 60} tint={info.isSpam ? "dark" : "light"} style={styles.glassPanel}>
              
              <View style={styles.actionGroup}>
                <TouchableOpacity style={[styles.controlBtn, styles.btnDecline]} onPress={handleDecline}>
                   <MaterialIcons name="call-end" size={32} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.btnLabel}>Decline</Text>
              </View>

              <View style={styles.actionGroup}>
                <TouchableOpacity style={[styles.controlBtn, styles.btnAccept]} onPress={handleAnswer}>
                   <MaterialIcons name="call" size={32} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.btnLabel}>Accept</Text>
              </View>

           </BlurView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'space-between' },
  topSection: { alignItems: 'center', marginTop: 20 },
  simPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.simBadge, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  simText: { color: THEME.colors.primary, fontSize: 13, fontWeight: '600' },
  spamBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  spamBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  profileSection: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  avatarContainer: { position: 'relative', marginBottom: 24 },
  avatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: '#FFF' },
  pulseRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2, top: 0, left: 0, opacity: 0.3 },
  infoBox: { alignItems: 'center', width: '80%' },
  nameText: { fontSize: 32, fontWeight: '700', color: '#1F1F1F', textAlign: 'center' },
  numberText: { fontSize: 18, color: '#64748B', marginTop: 4 },
  bottomSection: { paddingHorizontal: 24, paddingBottom: 40 },
  glassPanel: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.7)', 
    borderRadius: 35, paddingVertical: 25, paddingHorizontal: 30,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)'
  },
  actionGroup: { alignItems: 'center' },
  controlBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  btnDecline: { backgroundColor: '#EF4444' },
  btnAccept: { backgroundColor: '#10B981' },
  btnLabel: { marginTop: 12, fontSize: 14, fontWeight: '600', color: '#64748B' }
});