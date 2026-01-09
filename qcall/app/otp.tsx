import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, Animated, ActivityIndicator, Keyboard, 
  Platform, Easing, Dimensions 
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics'; // Added for premium feel
import { useUser } from '../context/UserContext'; 

const { width } = Dimensions.get('window');

export default function OtpScreen() {
  const router = useRouter();
  const { login } = useUser(); 
  const { phoneNumber, mode, actualOtp } = useLocalSearchParams();

  // Logic Helpers
  const mobileNumber = Array.isArray(phoneNumber) ? phoneNumber[0] : (phoneNumber || '');
  const correctOtp = Array.isArray(actualOtp) ? actualOtp[0] : (actualOtp || '');
  
  const [otp, setOtp] = useState(['', '', '', '']); 
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<Array<TextInput | null>>([]); 
  
  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 3) {
      inputs.current[index + 1]?.focus();
      Haptics.selectionAsync(); // Soft click sound
    }
  };

  const handleBackspace = (text: string, index: number) => {
    if (!text && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const enteredOtp = otp.join('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (enteredOtp.length !== 4) {
      return; // UI should show it's incomplete without an ugly alert
    }

    if (enteredOtp !== correctOtp) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 15, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -15, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 15, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const success = await login(mobileNumber);
        if (success) {
            router.replace("/(tabs)");
        } else {
            router.replace({ pathname: "/register", params: { phoneNumber: mobileNumber } });
        }
      } else {
        router.push({ pathname: "/register", params: { phoneNumber: mobileNumber, actualOtp } });
      }
    } catch (error) {
      Alert.alert("Error", "Could not verify. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#0F172A', '#1E293B', '#111']} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.iconCircle}>
            <Feather name="shield" size={36} color="#4ADE80" />
          </View>

          <Text style={styles.title}>Verification</Text>
          <Text style={styles.subText}>
            We've sent a 4-digit code to{"\n"}
            <Text style={styles.highlight}>+91 {mobileNumber}</Text>
          </Text>

          <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
            {otp.map((digit, index) => (
              <View key={index} style={[styles.inputBox, digit ? styles.inputBoxActive : null]}>
                <TextInput
                  ref={(ref) => { inputs.current[index] = ref }} 
                  style={styles.input}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  selectionColor="#3B82F6"
                  placeholderTextColor="rgba(255,255,255,0.1)"
                  placeholder="0"
                  onChangeText={(text) => handleChange(text, index)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace') handleBackspace(digit, index);
                  }}
                />
              </View>
            ))}
          </Animated.View>

          <View style={styles.timerContainer}>
            {timer > 0 ? (
              <View style={styles.timerPill}>
                <Feather name="clock" size={14} color="#94A3B8" style={{marginRight: 6}} />
                <Text style={styles.timerText}>Resend in <Text style={{color: '#FFF'}}>00:{timer < 10 ? `0${timer}` : timer}</Text></Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setTimer(30)} style={styles.resendBtn}>
                <Text style={styles.resendText}>Resend Code</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={handleVerify} disabled={loading} activeOpacity={0.8}>
            <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.button}>
              {loading ? (
                 <ActivityIndicator color="#FFF" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.buttonText}>Verify & Continue</Text>
                  <Feather name="arrow-right" size={20} color="#FFF" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Hidden Bypass Hint for Testing */}
          <Text style={styles.devCode}>Debug: {actualOtp}</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  safeContainer: { flex: 1, paddingHorizontal: 24 },
  header: { marginTop: 10, marginBottom: 20 },
  backBtn: { width: 45, height: 45, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(74, 222, 128, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 25, borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.2)' },
  title: { fontSize: 32, fontWeight: '800', color: '#FFF', marginBottom: 10 },
  subText: { fontSize: 16, color: '#94A3B8', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  highlight: { color: '#FFF', fontWeight: '700' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 40 },
  inputBox: { 
    width: (width - 100) / 4, 
    height: 75, 
    borderRadius: 20, 
    backgroundColor: 'rgba(30, 41, 59, 0.6)', 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  inputBoxActive: { borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)' },
  input: { fontSize: 32, fontWeight: '700', color: '#FFF', width: '100%', textAlign: 'center' },
  timerContainer: { marginBottom: 40 },
  timerPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  timerText: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  resendBtn: { padding: 10 },
  resendText: { color: '#3B82F6', fontWeight: '700', fontSize: 16 },
  button: { height: 60, width: width - 48, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#3B82F6', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  btnContent: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#FFF', marginRight: 10 },
  devCode: { marginTop: 40, color: 'rgba(255,255,255,0.05)', fontSize: 12 }
});