import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Animated, ActivityIndicator, KeyboardAvoidingView, 
  Platform, Keyboard, Easing, Dimensions 
  // ❌ REMOVED: Alert
} from 'react-native';
import { useRouter, Stack } from 'expo-router'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient'; 
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Import Redux Hook
import { useAuth } from '../hooks/useAuth'; 
// 🟢 IMPORT CUSTOM ALERT HOOK
import { useCustomAlert } from '../context/AlertContext';

const { width } = Dimensions.get('window');

// Background Particle Component
const Particle = ({ size, initialX, initialY, duration, delay }: any) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: duration, delay: delay, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(anim, { toValue: 0, duration: duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })
      ])
    ).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.4, 0.1] });
  return <Animated.View style={[styles.particle, { width: size, height: size, left: initialX, top: initialY, opacity, transform: [{ translateY }] }]} />;
};

export default function LoginScreen() {
  const router = useRouter();
  const { checkUserExists } = useAuth(); 
  
  // 🟢 HOOK THE ALERT SYSTEM
  const { showAlert } = useCustomAlert();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [devMode, setDevMode] = useState(true); 

  // Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current; 
  const slideAnim = useRef(new Animated.Value(50)).current; 
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.exp) })
    ]).start();
  }, []);

  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  const handleNext = async () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (phoneNumber.length < 10) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // 🟢 UPDATED: Use High-Def Alert
      showAlert("Invalid Number", "Please enter a valid 10-digit mobile number.", "warning");
      return;
    }

    setLoading(true);

    try {
        console.log(`[Login] Checking if user ${phoneNumber} exists...`);
        
        const exists = await checkUserExists(phoneNumber);
        
        setLoading(false);

        if (exists) {
            console.log("[Login] User found. Routing to OTP.");
            router.push({
                pathname: "/otp",
                params: { phoneNumber, bypass: devMode ? 'true' : 'false' } 
            });
        } else {
            console.log("[Login] New user. Routing to Register.");
            router.push({
                pathname: "/register",
                params: { phoneNumber, bypass: devMode ? 'true' : 'false' }
            });
        }
    } catch (e) {
        setLoading(false);
        console.error("Login Check Error:", e);
        
        // 🟢 UPDATED: Use High-Def Alert
        showAlert("Connection Error", "Could not verify user status. Please check your internet.", "error");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#0F172A', '#1E293B', '#111']} style={StyleSheet.absoluteFillObject} />
      
      <Particle size={120} initialX={-30} initialY={150} duration={5000} delay={0} />
      <Particle size={80} initialX={width - 50} initialY={400} duration={6000} delay={1000} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <Animated.View style={[styles.contentContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Ionicons name="call" size={32} color="#FFF" />
              </View>
              <Text style={styles.title}>Qcall</Text>
              <Text style={styles.subtitle}>Secure. Fast. Reliable.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Mobile Number</Text>
              
              <View style={[styles.inputContainer, isFocused && styles.inputFocused]}>
                <View style={styles.countryBadge}>
                  <Text style={styles.flag}>🇮🇳</Text>
                  <Text style={styles.code}>+91</Text>
                </View>
                <View style={styles.divider} />
                <TextInput 
                  style={styles.input}
                  placeholder="98765 43210"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  selectionColor="#3B82F6"
                />
              </View>

              <TouchableOpacity 
                onPress={handleNext} 
                onPressIn={onPressIn} 
                onPressOut={onPressOut} 
                disabled={loading} 
                activeOpacity={1}
              >
                <Animated.View style={[styles.btnMain, { transform: [{ scale: scaleAnim }] }]}>
                  <LinearGradient 
                    colors={['#3B82F6', '#2563EB']} 
                    start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                    style={styles.btnGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <View style={styles.btnContent}>
                        <Text style={styles.btnText}>
                            {devMode ? "Continue (Dev)" : "Get OTP"}
                        </Text>
                        <Feather name="arrow-right" size={20} color="#FFF" />
                      </View>
                    )}
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>

              <Text style={styles.footerText}>
                By continuing, you agree to our <Text style={styles.link}>Terms</Text>
              </Text>
            </View>
          </Animated.View>

          <View style={styles.devSection}>
            <TouchableOpacity 
              style={[styles.devToggle, devMode && styles.devToggleActive]} 
              onPress={() => setDevMode(!devMode)}
            >
              <MaterialIcons name={devMode ? "lock-open" : "lock"} size={14} color={devMode ? "#4ADE80" : "#94A3B8"} />
              <Text style={[styles.devText, devMode && styles.devTextActive]}>
                Dev Mode: {devMode ? "ON (Skip OTP)" : "OFF"}
              </Text>
            </TouchableOpacity>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  keyboardView: { flex: 1 },
  contentContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  particle: { position: 'absolute', borderRadius: 999, backgroundColor: '#3B82F6' },
  header: { alignItems: 'center', marginBottom: 40 },
  iconCircle: {
    width: 70, height: 70, borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  title: { fontSize: 34, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  subtitle: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 28, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  label: { fontSize: 12, color: '#94A3B8', marginBottom: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  inputContainer: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: 'rgba(15, 23, 42, 0.8)', 
    borderRadius: 18, height: 60, 
    borderWidth: 1, borderColor: '#334155',
    marginBottom: 20
  },
  inputFocused: { borderColor: '#3B82F6' },
  countryBadge: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12 },
  flag: { fontSize: 20, marginRight: 6 },
  code: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  divider: { width: 1, height: 24, backgroundColor: '#334155' },
  input: { flex: 1, fontSize: 18, fontWeight: '600', color: '#FFF', paddingHorizontal: 12 },
  btnMain: { borderRadius: 18, overflow: 'hidden' },
  btnGradient: { height: 58, justifyContent: 'center', alignItems: 'center' },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  footerText: { textAlign: 'center', marginTop: 22, color: '#64748B', fontSize: 12 },
  link: { color: '#3B82F6', fontWeight: '700' },
  devSection: { alignItems: 'center', paddingBottom: 20 },
  devToggle: { 
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 10, 
    borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
  },
  devToggleActive: { backgroundColor: 'rgba(74, 222, 128, 0.08)', borderColor: 'rgba(74, 222, 128, 0.2)' },
  devText: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  devTextActive: { color: '#4ADE80' }
});