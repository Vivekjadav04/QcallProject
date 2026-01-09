import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Image, TextInput, Animated, Easing, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

// 🔴 1. IMPORT USER CONTEXT
import { useUser } from '../../context/UserContext';

// --- COLORS ---
const COLORS = {
  primary: '#0056D2',
  background: '#fff',
  searchBarBg: '#ECECEC',
  textMain: '#1F1F1F',
  textSub: '#757575',
};

// --- SCENARIOS (Scammer/Spam Contexts) ---
const SCENARIOS = [
  "Caller: 'Hello, I am calling from the Tax Department regarding pending dues...'",
  "Caller: 'You have won a lottery! Just pay a small fee to claim it...'",
  "Caller: 'Your bank account has been compromised. Give me your OTP...'",
  "Caller: 'We are offering a pre-approved loan with 0% interest...'",
  "Caller: 'This is Amazon support. A suspicious purchase was made...'"
];

// --- 2. UPDATED HEADER COMPONENT ---
const HeaderComponent = ({ router, userPhoto }: any) => (
  <View style={styles.headerContainer}>
    <View style={styles.searchBar}>
      
      {/* 🔴 Dynamic Profile Picture */}
      <TouchableOpacity 
        style={styles.profileIconLeft}
        onPress={() => router.push('/(tabs)/profile')} // Navigate to Profile
      >
         {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
         ) : (
            // Fallback if no photo
            <View style={[styles.avatarImage, { backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center' }]}>
               <Ionicons name="person" size={18} color="#FFF" />
            </View>
         )}
      </TouchableOpacity>
      
      <TextInput 
        placeholder="Search Assistant..." 
        placeholderTextColor="#777" 
        style={styles.searchInput}
        editable={false} 
      />
      
      <View style={styles.searchRightIcons}>
         <TouchableOpacity style={styles.iconButton}>
           <MaterialCommunityIcons name="qrcode-scan" size={22} color="#555" />
         </TouchableOpacity>
      </View>
    </View>
  </View>
);

// --- FLOATING ICON COMPONENT ---
const FloatingIcon = ({ name, size, top, left, right, bottom, delay = 0 }: any) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 3000, delay: delay, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(floatAnim, { toValue: 0, duration: 3000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })
      ])
    ).start();
  }, []);

  return (
    <Animated.View 
      style={{ 
        position: 'absolute', top, left, right, bottom, opacity: 0.06, 
        transform: [{ translateY: floatAnim }, { rotate: '-10deg' }] 
      }}
    >
      <Ionicons name={name} size={size} color="#0056D2" />
    </Animated.View>
  );
};

export default function AssistScreen() {
  const router = useRouter();

  // 🔴 3. GET USER DATA FROM CONTEXT
  const { user } = useUser();
  const userPhoto = user?.profilePhoto || null;
  
  // Animations
  const phoneFloat = useRef(new Animated.Value(0)).current;
  
  // Typing Logic State
  const [typingText, setTypingText] = useState('');
  const [scenarioIndex, setScenarioIndex] = useState(0);

  useEffect(() => {
    // 1. Phone Floating Animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(phoneFloat, { toValue: -15, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(phoneFloat, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })
      ])
    ).start();

    // 2. Typing Effect Logic
    let charIndex = 0;
    const currentFullText = SCENARIOS[scenarioIndex];
    
    const typeInterval = setInterval(() => {
      setTypingText(currentFullText.slice(0, charIndex));
      charIndex++;

      // When finishing the sentence
      if (charIndex > currentFullText.length) {
        clearInterval(typeInterval);
        
        // Wait 2 seconds, then switch to next scenario
        setTimeout(() => {
           setScenarioIndex((prev) => (prev + 1) % SCENARIOS.length);
        }, 2000); 
      }
    }, 40); // Typing speed

    return () => clearInterval(typeInterval);
  }, [scenarioIndex]); // Re-run when scenario changes

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor="#fff" />

      {/* --- BACKGROUND PATTERN --- */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
         <FloatingIcon name="shield-checkmark" size={100} top={100} left={-20} delay={0} />
         <FloatingIcon name="call" size={80} top={250} right={-20} delay={1000} />
         <FloatingIcon name="chatbubble-ellipses" size={90} bottom={200} left={20} delay={500} />
      </View>

      {/* --- 4. PASS PHOTO & ROUTER TO HEADER --- */}
      <HeaderComponent router={router} userPhoto={userPhoto} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* HERO SECTION */}
        <Text style={styles.headline}>
          The all-new <Text style={{color: '#0056D2'}}>Assistant</Text>{'\n'}screens calls for you.
        </Text>
        
        <View style={styles.tag}>
          <Ionicons name="gift-outline" size={14} color="#00695C" style={{marginRight: 5}} />
          <Text style={styles.tagText}>14 DAYS FREE TRIAL</Text>
        </View>

        {/* --- ANIMATED PHONE --- */}
        <Animated.View style={[styles.phoneMockup, { transform: [{ translateY: phoneFloat }] }]}>
          <View style={styles.screen}>
            
            {/* 1. Header Layout Fixed here with flex:1 */}
            <View style={styles.incomingCallHeader}>
               <Ionicons name="person-circle" size={42} color="#fff" />
               <View style={styles.headerTextContainer}>
                 <Text style={styles.callerName} numberOfLines={1}>Unknown Caller</Text>
                 <Text style={styles.callerStatus}>Likely Spam • Scanning...</Text>
               </View>
            </View>
            
            <View style={styles.chatArea}>
               {/* Assistant Message */}
               <View style={styles.assistantBubble}>
                 <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
                    <Ionicons name="logo-android" size={12} color="#0056D2" />
                    <Text style={{fontSize: 10, color: '#0056D2', fontWeight: 'bold', marginLeft: 4}}>AI Assistant Screening</Text>
                 </View>
                 <Text style={{fontSize: 13, color: '#333', lineHeight: 18}}>
                   {typingText}<Text style={{color: '#0056D2'}}>|</Text>
                 </Text>
               </View>
            </View>

            {/* Fake Buttons */}
            <View style={styles.callActions}>
               <View style={[styles.circleBtn, {backgroundColor: '#FF3B30'}]}>
                 <Ionicons name="call" size={22} color="#fff" style={{transform: [{rotate: '135deg'}]}} />
               </View>
               <View style={[styles.circleBtn, {backgroundColor: '#34C759'}]}>
                 <Ionicons name="call" size={22} color="#fff" />
               </View>
            </View>
          </View>
        </Animated.View>

        {/* FEATURE LIST */}
        <View style={styles.featuresCard}>
          <FeatureItem text="AI answers calls on your behalf" icon="mic-outline" />
          <FeatureItem text="Real-time live transcript of the call" icon="document-text-outline" />
          <FeatureItem text="Filter out spam & robo-callers" icon="shield-checkmark-outline" />
          <FeatureItem text="Custom greeting messages" icon="chatbubbles-outline" />
        </View>

        {/* --- CALL TO ACTION --- */}
        <TouchableOpacity activeOpacity={0.8} style={styles.ctaContainer}>
          <LinearGradient
            colors={['#0087FF', '#0056D2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Text style={styles.btnText}>START FREE TRIAL</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{marginLeft: 8}} />
          </LinearGradient>
          <Text style={styles.cancelText}>No credit card required • Cancel anytime</Text>
        </TouchableOpacity>

        {/* --- EXTRA CONTENT (SCROLLABLE) --- */}
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>How it works</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepsScroll}>
           <StepCard 
             num="1" 
             title="You Decline" 
             desc="Reject the call or let it ring. The Assistant picks up automatically." 
             color="#E3F2FD" 
           />
           <StepCard 
             num="2" 
             title="AI Speaks" 
             desc="Our AI asks the caller who they are and why they are calling." 
             color="#E8F5E9" 
           />
           <StepCard 
             num="3" 
             title="You Decide" 
             desc="Read the live transcript and decide to pick up or block." 
             color="#FFF3E0" 
           />
        </ScrollView>

        <View style={{height: 100}} /> 
      </ScrollView>
    </SafeAreaView>
  );
}

const FeatureItem = ({text, icon}: {text: string, icon: any}) => (
  <View style={styles.featureRow}>
    <View style={styles.iconCircle}>
       <Ionicons name={icon} size={18} color="#0056D2" />
    </View>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const StepCard = ({num, title, desc, color}: any) => (
  <View style={[styles.stepCard, {backgroundColor: color}]}>
     <Text style={styles.stepNum}>{num}</Text>
     <Text style={styles.stepTitle}>{title}</Text>
     <Text style={styles.stepDesc}>{desc}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  
  // Header
  headerContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: '#fff', zIndex: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.searchBarBg, borderRadius: 30, paddingHorizontal: 10, height: 50 },
  profileIconLeft: { marginRight: 10 },
  avatarImage: { width: 32, height: 32, borderRadius: 16 },
  searchInput: { flex: 1, fontSize: 16, color: '#000' },
  searchRightIcons: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  iconButton: { padding: 5 },

  content: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  
  headline: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 10, color: '#1A1A1A', letterSpacing: -0.5 },
  
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2F1', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 30 },
  tagText: { color: '#00695C', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 },
  
  // Phone Mockup
  phoneMockup: { 
    width: 210, height: 400, backgroundColor: '#1A1A1A', borderRadius: 30, padding: 10, marginBottom: 30,
    shadowColor: '#0056D2', shadowOpacity: 0.25, shadowRadius: 20, elevation: 10, borderWidth: 4, borderColor: '#333'
  },
  screen: { flex: 1, backgroundColor: '#4A90E2', borderRadius: 20, padding: 15, justifyContent: 'space-between', overflow: 'hidden' },
  
  // FIXED HEADER LAYOUT
  incomingCallHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 15,
    width: '100%' // Ensure full width
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1, // Fixes the layout issue by taking remaining space
  },
  callerName: {
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 16,
    marginBottom: 2
  },
  callerStatus: {
    color: 'rgba(255,255,255,0.8)', 
    fontSize: 12
  },

  chatArea: { flex: 1, justifyContent: 'center' },
  assistantBubble: { backgroundColor: 'white', padding: 15, borderRadius: 16, borderTopLeftRadius: 4, width: '100%', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  
  callActions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  circleBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3 },

  // Features
  featuresCard: { width: '100%', backgroundColor: '#FAFAFA', borderRadius: 20, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: '#F0F0F0' },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  featureText: { fontSize: 15, color: '#444', fontWeight: '500', flex: 1 },

  // CTA
  ctaContainer: { width: '100%', alignItems: 'center', marginBottom: 40 },
  button: { width: '100%', paddingVertical: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#0087FF', shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  cancelText: { marginTop: 12, color: '#999', fontSize: 12 },

  // Steps Section
  sectionHeader: { width: '100%', paddingHorizontal: 10, marginBottom: 15 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' },
  stepsScroll: { width: '100%', paddingLeft: 5 },
  stepCard: { width: 140, height: 160, borderRadius: 20, padding: 15, marginRight: 15, justifyContent: 'space-between' },
  stepNum: { fontSize: 32, fontWeight: '900', color: 'rgba(0,0,0,0.1)' },
  stepTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  stepDesc: { fontSize: 12, color: '#666', lineHeight: 16 },
});