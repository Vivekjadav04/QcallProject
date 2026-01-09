import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Keyboard 
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendOtpToUser } from '../services/Fast2SmsService'; 
import { useUser } from '../context/UserContext'; 
import { API_BASE_URL } from '../constants/config';

// 🛠️ SIMPLE DECISION VARIABLE: Set to true to bypass OTP and register directly
const BYPASS_OTP = true; 

const endpoint='/auth';
const API_URL = `${API_BASE_URL}${endpoint}`; 

export default function RegisterScreen() {
  const router = useRouter();
  const { loadUser } = useUser(); 

  const { phoneNumber } = useLocalSearchParams(); 
  const mobileNumber = Array.isArray(phoneNumber) ? phoneNumber[0] : (phoneNumber || '');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // --- 🟢 CORE REGISTRATION & LOGIN LOGIC ---
  // This function creates the user in MongoDB and sets the session
  const performRegistrationAndLogin = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/register`, {
        phoneNumber: mobileNumber, 
        name,
        email
      });

      if (response.status === 201 || response.status === 200) {
        // 1. Save Session to local storage
        await AsyncStorage.setItem('user_phone', mobileNumber); 
        
        // 2. Load User data into Global Context (Enables profile updates)
        await loadUser();

        Alert.alert("Success", "Account created and logged in!");
        router.replace("/(tabs)"); 
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.msg || error.message;
      console.log("Registration Error:", errorMsg);
      Alert.alert("Registration Failed", typeof errorMsg === 'string' ? errorMsg : "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLE BUTTON CLICK ---
  const handleAction = async () => {
    Keyboard.dismiss();
    
    if (loading) return;

    if (!name || !email) {
      Alert.alert("Missing Info", "Please enter your Name and Email first.");
      return;
    }

    // --- 🛠️ BYPASS MODE: Register and Login immediately ---
    if (BYPASS_OTP) {
      console.log("🛠️ BYPASS ENABLED: Skipping OTP, registering user...");
      await performRegistrationAndLogin();
      return;
    }

    // --- 📲 STANDARD MODE: SMS OTP Flow ---
    setLoading(true);
    try {
        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        console.log("Registration OTP:", newOtp);

        const smsSent = await sendOtpToUser(mobileNumber, newOtp);

        if (smsSent) {
            setGeneratedOtp(newOtp);
            setOtpSent(true); 
            Alert.alert("OTP Sent", `Code sent to ${mobileNumber}`);
        } else {
            Alert.alert("Error", "Could not send OTP. Use BYPASS_OTP to test.");
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

  const getInputStyle = (field: string) => [
    styles.inputGroup, 
    focusedInput === field && styles.inputFocused
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <ScrollView contentContainerStyle={styles.content}>
            
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#222" />
              </TouchableOpacity>
              <View>
                <Text style={styles.headerTitle}>Create Account</Text>
                {BYPASS_OTP && <View style={styles.devBadge}><Text style={styles.devText}>BYPASS ON</Text></View>}
              </View>
            </View>
            <Text style={styles.headerSub}>Complete your profile to get started.</Text>

            <View style={styles.form}>
              
              <Text style={styles.label}>Mobile Number</Text>
              <View style={[styles.inputGroup, styles.disabledInput]}>
                <Ionicons name="call-outline" size={20} color="#888" style={{marginRight:12}} />
                <Text style={styles.disabledText}>+91 {mobileNumber}</Text>
              </View>

              <Text style={styles.label}>Full Name</Text>
              <View style={getInputStyle('name')}>
                <Ionicons name="person-outline" size={20} color="#888" style={{marginRight:12}} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Enter full name" 
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedInput('name')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <Text style={styles.label}>Email Address</Text>
              <View style={getInputStyle('email')}>
                <Ionicons name="mail-outline" size={20} color="#888" style={{marginRight:12}} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Enter email" 
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              {otpSent && !BYPASS_OTP && (
                <View style={{marginTop: 10}}>
                   <Text style={styles.label}>Verification Code</Text>
                   <View style={getInputStyle('otp')}>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#0087FF" style={{marginRight:12}} />
                      <TextInput 
                        style={[styles.input, { fontWeight: 'bold', letterSpacing: 4 }]} 
                        placeholder="XXXX" 
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
              >
                <LinearGradient
                  colors={['#0087FF', '#0056D2']}
                  style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.btnText}>
                      {otpSent ? "Confirm Registration" : BYPASS_OTP ? "Register & Login" : "Get OTP Code"}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  content: { padding: 24, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  devBadge: { backgroundColor: '#4CAF50', alignSelf: 'flex-start', paddingHorizontal: 6, borderRadius: 4, marginTop: 4 },
  devText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  backBtn: { width: 40, height: 40, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15, elevation: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
  headerSub: { fontSize: 16, color: '#666', marginBottom: 30 },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#444' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, height: 60, paddingHorizontal: 16, borderWidth: 1, borderColor: '#EEE' },
  inputFocused: { borderColor: '#0087FF' },
  input: { flex: 1, fontSize: 16, color: '#222', fontWeight: '500' },
  disabledInput: { backgroundColor: '#F5F5F5' },
  disabledText: { fontSize: 16, color: '#666', fontWeight: '600' },
  button: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFF' }
});