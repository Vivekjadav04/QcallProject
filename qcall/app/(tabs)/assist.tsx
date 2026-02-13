import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Image, TextInput, Animated, Easing, Dimensions, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { useAuth } from '../../hooks/useAuth';

const { width } = Dimensions.get('window');

// 🟢 THEME: White & Deep Sapphire
const THEME = {
  bg: '#FFFFFF',
  secondaryBg: '#F8FAFC', 
  primary: '#0F172A',   // Deep Navy
  accent: '#2563EB',    // Electric Blue
  aura: '#3B82F6',      // Lighter Blue for Glow
  textMain: '#1E293B',
  textSub: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
  danger: '#EF4444'
};

const SCENARIOS = [
  "Caller: 'Hello, calling from Tax Dept...'",
  "Caller: 'You won a lottery! Pay fee...'",
  "Caller: 'Bank alert! Give OTP now...'",
  "Caller: 'Pre-approved loan 0% interest...'"
];

// 🟢 CARD DATA
const CARD_WIDTH = 160;
const CARD_MARGIN = 16;
const FULL_CARD_SIZE = CARD_WIDTH + CARD_MARGIN;

const STEPS = [
  { id: '1', title: 'Call Screening', desc: 'AI answers unknown calls.', icon: 'call-outline', color: '#2563EB' },
  { id: '2', title: 'Intent Detect', desc: 'Asks caller for name & reason.', icon: 'analytics-outline', color: '#7C3AED' },
  { id: '3', title: 'Live Transcript', desc: 'Read the conversation real-time.', icon: 'chatbubbles-outline', color: '#059669' },
  { id: '4', title: 'Spam Block', desc: 'Robocalls are instantly blocked.', icon: 'shield-checkmark-outline', color: '#DC2626' },
  { id: '5', title: 'Smart Reply', desc: 'Tap to ask AI to suggest replies.', icon: 'bulb-outline', color: '#D97706' },
  { id: '6', title: 'Privacy First', desc: 'Calls processed securely on device.', icon: 'lock-closed-outline', color: '#0891B2' },
];

// Duplicate data to create seamless loop
const MARQUEE_DATA = [...STEPS, ...STEPS, ...STEPS]; 

// --- HEADER ---
const HeaderComponent = ({ router, userPhoto }: any) => (
  <View style={styles.headerWrapper}>
    <View style={styles.topRow}>
        <View>
            <Text style={styles.headerDate}>AI PROTECTION</Text>
            <Text style={styles.headerTitle}>Assistant</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')} activeOpacity={0.8}>
            {userPhoto ? (
                <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
            ) : (
                <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={24} color="#FFF" />
                </View>
            )}
        </TouchableOpacity>
    </View>
    <View style={styles.searchBlock}>
        <Ionicons name="sparkles" size={18} color={THEME.accent} />
        <TextInput 
            placeholder="Ask QCall Assistant..." 
            placeholderTextColor={THEME.textSub} 
            style={styles.searchInput}
            editable={false} 
        />
    </View>
  </View>
);

// --- FLOATING BACKGROUND ---
const FloatingIcon = ({ name, size, top, left, right, bottom, delay = 0 }: any) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -15, duration: 4000, delay: delay, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(floatAnim, { toValue: 0, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ position: 'absolute', top, left, right, bottom, opacity: 0.03, transform: [{ translateY: floatAnim }, { rotate: '-10deg' }] }}>
      <Ionicons name={name} size={size} color={THEME.primary} />
    </Animated.View>
  );
};

export default function AssistScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userPhoto = user?.profilePhoto || null;
  
  const phoneFloat = useRef(new Animated.Value(0)).current;
  const auraAnim = useRef(new Animated.Value(0.3)).current; // 🟢 Aura Opacity
  
  // 🟢 Marquee Animation Refs
  const scrollX = useRef(new Animated.Value(0)).current;
  const [isPaused, setIsPaused] = useState(false);

  const [typingText, setTypingText] = useState('');
  const [scenarioIndex, setScenarioIndex] = useState(0);

  useEffect(() => {
    // 1. Phone Floating
    Animated.loop(
      Animated.sequence([
        Animated.timing(phoneFloat, { toValue: -10, duration: 2500, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(phoneFloat, { toValue: 0, duration: 2500, useNativeDriver: true, easing: Easing.inOut(Easing.quad) })
      ])
    ).start();

    // 2. 🟢 Aura Pulsing Animation (Inner Border)
    Animated.loop(
      Animated.sequence([
        Animated.timing(auraAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(auraAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true })
      ])
    ).start();

    // 3. Typing Logic
    let charIndex = 0;
    const currentFullText = SCENARIOS[scenarioIndex];
    const typeInterval = setInterval(() => {
      setTypingText(currentFullText.slice(0, charIndex));
      charIndex++;
      if (charIndex > currentFullText.length) {
        clearInterval(typeInterval);
        setTimeout(() => setScenarioIndex((prev) => (prev + 1) % SCENARIOS.length), 2000); 
      }
    }, 40); 
    return () => clearInterval(typeInterval);
  }, [scenarioIndex]);

  // 🟢 4. SMOOTH SCROLL MARQUEE LOGIC
  useEffect(() => {
    let animationLoop: Animated.CompositeAnimation;

    const startAnimation = () => {
      // Calculate total width of one set of items
      const totalWidth = STEPS.length * FULL_CARD_SIZE;
      
      // Reset value if needed to create seamless loop
      // We animate from 0 to -totalWidth, then reset instantly
      scrollX.setValue(0);

      animationLoop = Animated.loop(
        Animated.timing(scrollX, {
          toValue: -totalWidth,
          duration: 15000, // 15 seconds for one cycle
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      
      if (!isPaused) {
        animationLoop.start();
      }
    };

    startAnimation();

    return () => {
      if (animationLoop) animationLoop.stop();
    };
  }, [isPaused]); // Restart when unpaused

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor={THEME.bg} />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
         <FloatingIcon name="shield-checkmark" size={120} top={80} left={-30} delay={0} />
         <FloatingIcon name="call" size={90} top={300} right={-20} delay={1000} />
         <FloatingIcon name="analytics" size={100} bottom={150} left={20} delay={500} />
      </View>

      <HeaderComponent router={router} userPhoto={userPhoto} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* HERO */}
        <Text style={styles.headline}>
          Intelligent Call{'\n'}
          <Text style={{color: THEME.accent}}>Screening & Defense</Text>
        </Text>
        
        <View style={styles.premiumTag}>
          <LinearGradient colors={['#10B981', '#059669']} style={styles.tagGradient} start={{x:0, y:0}} end={{x:1, y:0}}>
             <Ionicons name="shield-checkmark" size={12} color="#FFF" style={{marginRight: 6}} />
             <Text style={styles.tagText}>ACTIVE PROTECTION</Text>
          </LinearGradient>
        </View>

        {/* --- LUXURY PHONE MOCKUP --- */}
        <Animated.View style={[styles.phoneMockup, { transform: [{ translateY: phoneFloat }] }]}>
          <View style={styles.screen}>
            
            {/* 🟢 AURA LIGHT (Inner Border Glow) */}
            <Animated.View style={[styles.auraBorder, { opacity: auraAnim }]} pointerEvents="none" />

            {/* Header Layout */}
            <View style={styles.incomingCallHeader}>
               <View style={styles.callerIcon}>
                  <Ionicons name="person" size={24} color="#FFF" />
               </View>
               <View style={styles.headerTextContainer}>
                 <Text style={styles.callerName} numberOfLines={1}>Potential Spam</Text>
                 <Text style={styles.callerStatus}>Assistant is listening...</Text>
               </View>
            </View>
            
            {/* Chat Bubble */}
            <View style={styles.chatArea}>
               <View style={styles.assistantBubble}>
                 <View style={styles.bubbleHeader}>
                    <Ionicons name="logo-android" size={14} color={THEME.accent} />
                    <Text style={styles.bubbleTitle}>QCall Assistant</Text>
                 </View>
                 <Text style={styles.bubbleText}>
                   {typingText}<Text style={{color: THEME.accent}}>|</Text>
                 </Text>
               </View>
            </View>

            {/* Buttons */}
            <View style={styles.callActions}>
               <View style={[styles.circleBtn, {backgroundColor: '#FF453A'}]}>
                 <Ionicons name="close" size={24} color="#fff" />
               </View>
               <View style={[styles.circleBtn, {backgroundColor: '#30D158'}]}>
                 <Ionicons name="checkmark" size={24} color="#fff" />
               </View>
            </View>
          </View>
        </Animated.View>

        {/* FEATURE CARDS (Glassy) */}
        <View style={styles.featuresCard}>
          <FeatureItem text="Auto-screens unknown numbers" icon="git-network-outline" />
          <FeatureItem text="Live real-time transcription" icon="text-outline" />
          <FeatureItem text="Blocks robocalls instantly" icon="ban-outline" />
        </View>

        {/* --- SMOOTH MARQUEE SCROLL SECTION --- */}
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>How It Works</Text>
           <View style={styles.liveBadge}>
               <View style={styles.liveDot} />
               <Text style={styles.liveText}>LIVE</Text>
           </View>
        </View>

        {/* 🟢 MARQUEE CONTAINER */}
        <View style={{height: 190, marginBottom: 30}}>
            {/* Touch to pause wrapper */}
            <Pressable 
                onPressIn={() => setIsPaused(true)} 
                onPressOut={() => setIsPaused(false)}
                style={{flex: 1}}
            >
                <Animated.View style={{ 
                    flexDirection: 'row', 
                    paddingHorizontal: 14, 
                    transform: [{ translateX: scrollX }] // Moves the whole row
                }}>
                    {MARQUEE_DATA.map((item, index) => (
                        <View key={`${item.id}-${index}`} style={styles.stepCard}>
                            <View style={[styles.stepIconBox, { backgroundColor: `${item.color}15` }]}>
                                <Ionicons name={item.icon as any} size={24} color={item.color} />
                            </View>
                            <Text style={styles.stepTitle}>{item.title}</Text>
                            <Text style={styles.stepDesc}>{item.desc}</Text>
                        </View>
                    ))}
                </Animated.View>
            </Pressable>
        </View>

        {/* --- CTA --- */}
        <TouchableOpacity activeOpacity={0.8} style={styles.ctaContainer}>
          <LinearGradient
            colors={[THEME.primary, '#334155']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <Text style={styles.btnText}>ACTIVATE ASSISTANT</Text>
            <View style={styles.btnIcon}>
                <Ionicons name="arrow-forward" size={18} color={THEME.primary} />
            </View>
          </LinearGradient>
          <Text style={styles.cancelText}>Included with Premium Plan</Text>
        </TouchableOpacity>

        <View style={{height: 100}} /> 
      </ScrollView>
    </SafeAreaView>
  );
}

const FeatureItem = ({text, icon}: {text: string, icon: any}) => (
  <View style={styles.featureRow}>
    <View style={styles.iconCircle}>
       <Ionicons name={icon} size={18} color={THEME.accent} />
    </View>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.bg },
  
  // Header
  headerWrapper: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, backgroundColor: THEME.bg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerDate: { fontSize: 13, color: THEME.textSub, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 34, fontWeight: '900', color: THEME.primary, letterSpacing: -1 },
  profileBtn: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  avatarImage: { width: 48, height: 48, borderRadius: 18, borderWidth: 2, borderColor: '#FFF' },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 18, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  searchBlock: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, height: 52, borderRadius: 20, borderWidth: 1, borderColor: THEME.border, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: THEME.textMain, fontWeight: '500' },

  content: { paddingHorizontal: 24, alignItems: 'center' },
  
  headline: { fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 15, color: THEME.primary, letterSpacing: -1, lineHeight: 38 },
  
  premiumTag: { marginBottom: 35, shadowColor: THEME.success, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  tagGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  tagText: { color: '#FFF', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  
  // Phone
  phoneMockup: { 
    width: 240, height: 460, backgroundColor: '#0F172A', borderRadius: 36, padding: 12, marginBottom: 40,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 30, elevation: 20, borderWidth: 6, borderColor: '#1E293B'
  },
  screen: { flex: 1, backgroundColor: '#1E293B', borderRadius: 24, padding: 16, justifyContent: 'space-between', overflow: 'hidden' },
  
  // 🟢 AURA BORDER (Inner Glow)
  auraBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: THEME.aura, // Electric Blue Glow
    zIndex: 2
  },

  incomingCallHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20, width: '100%' },
  callerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTextContainer: { marginLeft: 14, flex: 1 },
  callerName: { color: 'white', fontWeight: '700', fontSize: 18, marginBottom: 4 },
  callerStatus: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },

  chatArea: { flex: 1, justifyContent: 'center' },
  assistantBubble: { backgroundColor: '#FFF', padding: 16, borderRadius: 20, borderTopLeftRadius: 4, width: '100%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bubbleTitle: { fontSize: 11, color: THEME.accent, fontWeight: '800', marginLeft: 6, textTransform: 'uppercase' },
  bubbleText: { fontSize: 15, color: '#334155', lineHeight: 22, fontWeight: '500' },
  
  callActions: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 10 },
  circleBtn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },

  // Features
  featuresCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, marginBottom: 40, borderWidth: 1, borderColor: THEME.border, shadowColor: '#2563EB', shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  iconCircle: { width: 36, height: 36, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  featureText: { fontSize: 15, color: '#334155', fontWeight: '600', flex: 1 },

  // Marquee Steps
  sectionHeader: { width: '100%', flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal: 4, marginBottom: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: THEME.primary, letterSpacing: -0.5 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.success, marginRight: 6 },
  liveText: { color: THEME.success, fontSize: 10, fontWeight: '700' },

  stepCard: { 
    width: CARD_WIDTH, height: 180, backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginRight: CARD_MARGIN, 
    justifyContent: 'space-between', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 3 
  },
  stepIconBox: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  stepTitle: { fontSize: 16, fontWeight: '700', color: THEME.primary, marginTop: 12 },
  stepDesc: { fontSize: 13, color: THEME.textSub, lineHeight: 18, fontWeight: '500' },

  // CTA
  ctaContainer: { width: '100%', alignItems: 'center', marginBottom: 50 },
  button: { width: '100%', paddingVertical: 18, paddingHorizontal: 24, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 1 },
  btnIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  cancelText: { marginTop: 14, color: THEME.textSub, fontSize: 13, fontWeight: '500' },
});