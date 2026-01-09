import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, NativeModules, 
  NativeEventEmitter, Animated, Easing, Platform 
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

// 🟢 SAFE MODULE ACCESS
const { CallManagerModule } = NativeModules;
const callEventEmitter = CallManagerModule ? new NativeEventEmitter(CallManagerModule) : null;

const THEME = {
  primary: '#0056D2',
  success: '#10B981',
  danger: '#EF4444',
  textMain: '#111827',
  textSub: '#6B7280',
  glass: 'rgba(255, 255, 255, 0.8)'
};

export default function OutgoingCallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [status, setStatus] = useState(params.status || 'Dialing'); 
  const [duration, setDuration] = useState('00:00');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  
  const startTimeRef = useRef<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 1. START OR SYNC CALL (CRASH PROOF)
  useEffect(() => {
    if (isEnded) return;

    // 🟢 SAFEGUARD: Check if module and method exist before calling
    if (CallManagerModule && CallManagerModule.getActiveCallInfo) {
       CallManagerModule.getActiveCallInfo()
        .then((data: any) => {
            if (data.status === 'Active' || data.status === 'Dialing') {
                console.log("🔄 Syncing Existing Call:", data.status);
                setStatus(data.status);
                if (data.status === 'Active' && !startTimeRef.current) {
                    startTimeRef.current = Date.now(); 
                }
            } else if (data.status === 'Idle' && params.number && status !== 'Active') {
                 // Only start call if we are NOT testing via debug button with "Active" status
                 console.log("🚀 Starting New Call to:", params.number);
                 CallManagerModule.startCall(params.number as string);
            }
       })
       .catch((err: any) => console.warn("Native Call Error:", err));
    } else {
        // Fallback: If native module is missing method, try blindly starting call to avoid doing nothing
        if (CallManagerModule?.startCall && params.number) {
            console.log("⚠️ Legacy Start Call");
            CallManagerModule.startCall(params.number as string);
        } else {
            console.warn("⚠️ CallManagerModule missing or not rebuilt.");
        }
    }
  }, []); 

  // 2. LISTEN FOR EVENTS
  useEffect(() => {
    if (!callEventEmitter) return;

    const subscription = callEventEmitter.addListener('onCallStateChanged', (e: { status: string }) => {
      console.log("📞 Native Event:", e.status);
      setStatus(e.status);

      if (e.status === 'Active' && !startTimeRef.current) {
          startTimeRef.current = Date.now(); 
      }

      if (e.status === 'Disconnected' || e.status === 'Idle') {
         handleEndCall(false); 
      }
    });

    return () => subscription.remove();
  }, []);

  // 3. TIMER LOGIC
  useEffect(() => {
    const interval = setInterval(() => {
      if (status === 'Active' && startTimeRef.current) {
        const now = Date.now();
        const diffInSeconds = Math.floor((now - startTimeRef.current) / 1000);
        const mins = Math.floor(diffInSeconds / 60).toString().padStart(2, '0');
        const secs = (diffInSeconds % 60).toString().padStart(2, '0');
        setDuration(`${mins}:${secs}`);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [status]);

  // 4. KEEP AWAKE
  useEffect(() => {
    activateKeepAwakeAsync().catch(() => {});
    return () => { deactivateKeepAwake(); };
  }, []);

  // Animation Loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
      ])
    ).start();
  }, []);

  const toggleMute = () => { 
      const newState = !isMuted;
      setIsMuted(newState); 
      if(CallManagerModule?.setMuted) CallManagerModule.setMuted(newState); 
  };
  
  const toggleSpeaker = () => { 
      const newState = !isSpeaker;
      setIsSpeaker(newState); 
      if(CallManagerModule?.setSpeakerphoneOn) CallManagerModule.setSpeakerphoneOn(newState); 
  };

  const handleEndCall = (shouldCallNative = true) => {
      if (isEnded) return; 
      setIsEnded(true);
      setStatus('Ended'); 
      
      if (shouldCallNative && CallManagerModule?.endCall) {
          CallManagerModule.endCall();
      }
      
      setTimeout(() => { 
          if (router.canGoBack()) router.dismissAll(); 
          router.replace('/(tabs)'); 
      }, 1000);
  };

  const ActionButton = ({ icon, label, onPress, active }: any) => (
    <TouchableOpacity onPress={onPress} style={styles.actionItem}>
      <View style={[ styles.actionCircle, active && { backgroundColor: THEME.primary, borderColor: THEME.primary } ]}>
        <Ionicons name={icon} size={26} color={active ? "#FFF" : "#4B5563"} />
      </View>
      <Text style={[styles.actionLabel, active && { color: THEME.primary, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient colors={['#E0F2FE', '#F0F9FF', '#FFFFFF']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.topSection}>
        <View style={styles.encryptionBadge}>
          <Feather name="shield" size={12} color={THEME.textSub} />
          <Text style={styles.encryptionText}>SECURE CALL</Text>
        </View>

        <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: pulseAnim }] }]}>
          {params.imageUri ? (
            <Image source={{ uri: params.imageUri as string }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{(params.name as string || 'U')[0]}</Text>
            </View>
          )}
        </Animated.View>

        <Text style={styles.nameText}>{params.name || 'Unknown'}</Text>
        <Text style={styles.numberText}>{params.number}</Text>

        <View style={[styles.statusBadge, status === 'Active' && styles.statusBadgeActive]}>
          <View style={[styles.statusDot, { backgroundColor: status === 'Active' ? THEME.success : '#F59E0B' }]} />
          <Text style={styles.statusText}>
            {status === 'Active' ? duration : status}
          </Text>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <BlurView intensity={80} tint="light" style={styles.controlsCard}>
          <View style={styles.grid}>
            <ActionButton icon={isMuted ? "mic-off" : "mic-outline"} label="Mute" onPress={toggleMute} active={isMuted} />
            <ActionButton icon="keypad-outline" label="Keypad" />
            <ActionButton icon={isSpeaker ? "volume-high" : "volume-medium-outline"} label="Speaker" onPress={toggleSpeaker} active={isSpeaker} />
            <ActionButton icon="add-outline" label="Add Call" />
            <ActionButton icon="videocam-outline" label="Video" />
            <ActionButton icon="pause-outline" label="Hold" />
          </View>

          <TouchableOpacity style={styles.endBtn} onPress={() => handleEndCall(true)}>
            <MaterialIcons name="call-end" size={36} color="#FFF" />
          </TouchableOpacity>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  topSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  encryptionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 30 },
  encryptionText: { fontSize: 10, fontWeight: '800', color: THEME.textSub, marginLeft: 5, letterSpacing: 1 },
  avatarWrapper: { shadowColor: THEME.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  avatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 5, borderColor: '#FFF' },
  avatarPlaceholder: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', borderWidth: 5, borderColor: '#FFF' },
  avatarInitial: { fontSize: 50, fontWeight: 'bold', color: THEME.textSub },
  nameText: { fontSize: 32, fontWeight: '800', color: THEME.textMain, marginTop: 25, letterSpacing: -0.5 },
  numberText: { fontSize: 18, color: THEME.textSub, marginTop: 5, fontWeight: '500' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)' },
  statusBadgeActive: { backgroundColor: '#ECFDF5' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 15, fontWeight: '700', color: THEME.textMain, fontVariant: ['tabular-nums'] },
  bottomSection: { paddingHorizontal: 20, paddingBottom: 40 },
  controlsCard: { borderRadius: 32, padding: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  actionItem: { width: '30%', alignItems: 'center', marginBottom: 20 },
  actionCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  actionLabel: { fontSize: 12, color: THEME.textSub, fontWeight: '600' },
  endBtn: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: THEME.danger, justifyContent: 'center', alignItems: 'center', shadowColor: THEME.danger, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }
});