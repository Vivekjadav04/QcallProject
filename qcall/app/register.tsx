import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, 
  Keyboard, Dimensions, Animated, Easing
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';

// 🟢 Services & Config
import { sendOtpToUser } from '../services/Fast2SmsService'; 
import { API_BASE_URL } from '../constants/config';
import { useAuth } from '../hooks/useAuth'; 

const { width } = Dimensions.get('window');
const endpoint='/auth';
const API_URL = `${API_BASE_URL}${endpoint}`; 

// Particle Component
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

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth(); 

  // 1. GET PARAMS
  const { phoneNumber, bypass } = useLocalSearchParams(); 
  const mobileNumber = Array.isArray(phoneNumber) ? phoneNumber[0] : (phoneNumber || '');
  const isBypass = bypass === 'true';

  // 🟢 UPDATED: Separate State for First/Last Name
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.exp) })
    ]).start();
  }, []);

  // --- CORE REGISTRATION LOGIC ---
  const performRegistrationAndLogin = async () => {
    try {
      setLoading(true);
      // 🟢 UPDATED: Send firstName and lastName separately
      const response = await axios.post(`${API_URL}/register`, {
        phoneNumber: mobileNumber, 
        firstName,
        lastName,
        email
      });

      if (response.status === 201 || response.status === 200) {
        await login(mobileNumber);
        Alert.alert("Success", "Account created!");
        router.replace("/welcome"); 
      }
    } catch (error: any) {
      if (error.response && error.response.status === 400) {
          Alert.alert("Welcome Back", "Number registered. Logging you in...");
          await login(mobileNumber);
          router.replace("/welcome"); 
          return;
      }
      const errorMsg = error.response?.data?.msg || error.message;
      Alert.alert("Registration Failed", typeof errorMsg === 'string' ? errorMsg : "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLE BUTTON CLICK ---
  const handleAction = async () => {
    Keyboard.dismiss();
    if (loading) return;

    // 🟢 UPDATED: Validation checks for First/Last Name
    if (!firstName || !lastName || !email) {
      Alert.alert("Missing Info", "Please fill in all fields (First Name, Last Name, Email).");
      return;
    }

    if (isBypass) {
      await performRegistrationAndLogin();
      return;
    }

    setLoading(true);
    try {
        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const smsSent = await sendOtpToUser(mobileNumber, newOtp);

        if (smsSent) {
            setGeneratedOtp(newOtp);
            setOtpSent(true); 
            Alert.alert("OTP Sent", `Code sent to ${mobileNumber}`);
        } else {
            Alert.alert("Error", "Could not send OTP.");
        }
    } catch (e) {
        Alert.alert("Error", "Failed to send OTP");
    } finally {
        setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpInput !== generatedOtp) {
      Alert.alert("Wrong OTP", "The code you entered is incorrect.");
      return;
    }
    await performRegistrationAndLogin();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#0F172A', '#1E293B', '#111']} style={StyleSheet.absoluteFillObject} />
      
      <Particle size={120} initialX={-30} initialY={150} duration={5000} delay={0} />
      <Particle size={80} initialX={width - 50} initialY={400} duration={6000} delay={1000} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <ScrollView contentContainerStyle={styles.content}>
            
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              
              <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View>
                  <Text style={styles.headerTitle}>Create Account</Text>
                  {isBypass && <Text style={styles.devText}>DEV MODE: OTP BYPASSED</Text>}
                </View>
              </View>

              <View style={styles.card}>
                
                <Text style={styles.label}>Mobile Number</Text>
                <View style={[styles.inputContainer, styles.disabledInput]}>
                  <Ionicons name="call" size={20} color="#64748B" style={{marginRight:12}} />
                  <Text style={styles.disabledText}>+91 {mobileNumber}</Text>
                  <Ionicons name="lock-closed" size={16} color="#64748B" style={{marginLeft: 'auto'}} />
                </View>

                {/* 🟢 UPDATED: Split First Name & Last Name Inputs */}
                <View style={{flexDirection: 'row', gap: 12}}>
                    <View style={{flex: 1}}>
                        <Text style={styles.label}>First Name</Text>
                        <View style={[styles.inputContainer, focusedInput === 'firstName' && styles.inputFocused]}>
                        <TextInput 
                            style={styles.input} 
                            placeholder="First Name" 
                            placeholderTextColor="#64748B"
                            value={firstName}
                            onChangeText={setFirstName}
                            onFocus={() => setFocusedInput('firstName')}
                            onBlur={() => setFocusedInput(null)}
                        />
                        </View>
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={styles.label}>Last Name</Text>
                        <View style={[styles.inputContainer, focusedInput === 'lastName' && styles.inputFocused]}>
                        <TextInput 
                            style={styles.input} 
                            placeholder="Last Name" 
                            placeholderTextColor="#64748B"
                            value={lastName}
                            onChangeText={setLastName}
                            onFocus={() => setFocusedInput('lastName')}
                            onBlur={() => setFocusedInput(null)}
                        />
                        </View>
                    </View>
                </View>

                <Text style={styles.label}>Email Address</Text>
                <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputFocused]}>
                  <Ionicons name="mail" size={20} color="#94A3B8" style={{marginRight:12}} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Enter email" 
                    placeholderTextColor="#64748B"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>

                {otpSent && !isBypass && (
                  <View style={{marginTop: 10}}>
                      <Text style={styles.label}>Verification Code</Text>
                      <View style={[styles.inputContainer, focusedInput === 'otp' && styles.inputFocused]}>
                         <Ionicons name="shield-checkmark" size={20} color="#3B82F6" style={{marginRight:12}} />
                         <TextInput 
                           style={[styles.input, { letterSpacing: 4, fontWeight: 'bold' }]} 
                           placeholder="XXXX" 
                           placeholderTextColor="#64748B"
                           keyboardType="number-pad"
                           maxLength={4}
                           value={otpInput}
                           onChangeText={setOtpInput}
                           onFocus={() => setFocusedInput('otp')}
                           onBlur={() => setFocusedInput(null)}
                         />
                      </View>
                  </View>
                )}

                <TouchableOpacity 
                  onPress={otpSent ? handleVerifyOtp : handleAction} 
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                    style={styles.button}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <View style={styles.btnContent}>
                        <Text style={styles.btnText}>
                          {otpSent ? "Confirm Registration" : isBypass ? "Register Now" : "Get OTP Code"}
                        </Text>
                        <Feather name="arrow-right" size={20} color="#FFF" />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

              </View>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 24, paddingTop: 10 },
  particle: { position: 'absolute', borderRadius: 999, backgroundColor: '#3B82F6' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  backBtn: { 
    width: 40, height: 40, borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    justifyContent: 'center', alignItems: 'center', 
    marginRight: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' 
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  devText: { color: '#4ADE80', fontSize: 10, fontWeight: '700', marginTop: 4 },
  
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 28, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  label: { fontSize: 12, color: '#94A3B8', marginBottom: 10, marginTop: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  
  inputContainer: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: 'rgba(15, 23, 42, 0.8)', 
    borderRadius: 18, height: 60, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  inputFocused: { borderColor: '#3B82F6' },
  disabledInput: { backgroundColor: 'rgba(15, 23, 42, 0.4)', borderColor: '#1E293B' },
  disabledText: { fontSize: 16, color: '#64748B', fontWeight: '600' },
  
  input: { flex: 1, fontSize: 16, color: '#FFF', fontWeight: '500' },
  
  button: { height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFF' }
});