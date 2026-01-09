import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Platform, Easing 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85; 
const SPACING = (width - CARD_WIDTH) / 2;

// --- FLOATING ICON COMPONENT (Background Animation) ---
const FloatingIcon = ({ name, size, top, left, right, bottom, delay = 0, color = '#0056D2' }: any) => {
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
    <Animated.View 
      style={{ 
        position: 'absolute', top, left, right, bottom, opacity: 0.05, 
        transform: [{ translateY: floatAnim }, { rotate: '-10deg' }] 
      }}
    >
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
};

// --- DATA ---
const PLANS = [
  {
    id: '1',
    name: 'Connect',
    sub: 'Starter',
    gradient: ['#4481EB', '#04BEFE'], // Blue Gradient
    priceMonth: '₹75',
    priceYear: '₹529',
    features: [
      { text: 'No Ads', active: true, icon: 'advertisement-off' },
      { text: 'Spam Blocking', active: true, icon: 'shield-check' },
      { text: 'Who Searched Me', active: true, icon: 'eye-outline' },
      { text: 'Incognito Mode', active: true, icon: 'incognito' },
      { text: 'Ghost Call', active: false, icon: 'ghost-outline' },
    ]
  },
  {
    id: '2',
    name: 'Assistant',
    sub: 'Most Popular',
    gradient: ['#654ea3', '#eaafc8'], // Purple/Pink Gradient
    priceMonth: '₹99',
    priceYear: '₹899',
    features: [
      { text: 'All Connect Features', active: true, icon: 'check-all' },
      { text: 'Digital Assistant', active: true, icon: 'robot' },
      { text: 'Call Screening', active: true, icon: 'phone-in-talk' },
      { text: 'Custom Greeting', active: true, icon: 'microphone-outline' },
      { text: 'Gold ID', active: false, icon: 'star-outline' },
    ]
  },
  {
    id: '3',
    name: 'Family',
    sub: 'Best Value',
    gradient: ['#FF416C', '#FF4B2B'], // Red/Orange Gradient
    priceMonth: '₹149',
    priceYear: '₹1,499',
    features: [
      { text: 'All Connect Features', active: true, icon: 'check-all' },
      { text: 'Up to 5 Accounts', active: true, icon: 'account-group' },
      { text: 'Family Dashboard', active: true, icon: 'view-dashboard-outline' },
      { text: 'Separate Billing', active: true, icon: 'receipt' },
      { text: 'Gold ID', active: false, icon: 'star-outline' },
    ]
  },
  {
    id: '4',
    name: 'Gold',
    sub: 'VIP Status',
    gradient: ['#FFD700', '#FDB931'], // Gold Gradient
    textColor: '#000',
    isGold: true,
    priceMonth: '₹4,999',
    priceYear: '₹5,000',
    features: [
      { text: 'All Premium Features', active: true, icon: 'star-four-points' },
      { text: 'Gold Caller ID', active: true, icon: 'card-account-details-star' },
      { text: 'Priority Support', active: true, icon: 'face-agent' },
      { text: 'VIP Badge', active: true, icon: 'crown' },
      { text: 'High Priority', active: true, icon: 'arrow-up-bold-circle-outline' },
    ]
  },
];

// --- COMPARE DATA ---
const COMPARE_ROWS = [
  { label: 'Ad-Free Experience', icon: 'advertisement-off', vals: [true, true, true, true] },
  { label: 'Adv. Spam Block', icon: 'shield-check', vals: [true, true, true, true] },
  { label: 'Who Viewed Me', icon: 'eye', vals: [true, true, true, true] },
  { label: 'Digital Assistant', icon: 'robot', vals: [false, true, false, true] },
  { label: 'Call Screening', icon: 'phone-in-talk', vals: [false, true, false, true] },
  { label: 'Family Plan (5)', icon: 'account-group', vals: [false, false, true, false] },
  { label: 'Gold Caller ID', icon: 'star', vals: [false, false, false, true] },
  { label: 'VIP Support', icon: 'face-agent', vals: [false, false, false, true] },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;

  // --- RENDER PLAN CARD ---
  const renderPlanCard = ({ item, index }: { item: any, index: number }) => {
    
    // Scaling Animation based on scroll position
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp'
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.7, 1, 0.7],
      extrapolate: 'clamp'
    });

    return (
      <View style={{ width: width, alignItems: 'center', paddingTop: 20 }}>
        <Animated.View style={[styles.cardContainer, { transform: [{ scale }], opacity }]}>
          <LinearGradient
            colors={item.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            {/* Header */}
            <View style={styles.cardHeader}>
               <View>
                 <Text style={styles.planSub}>{item.sub}</Text>
                 <Text style={styles.planName}>{item.name}</Text>
               </View>
               <View style={styles.iconCircle}>
                 <MaterialCommunityIcons name="crown" size={24} color={item.isGold ? '#DAA520' : item.gradient[0]} />
               </View>
            </View>

            {/* Price */}
            <View style={styles.priceContainer}>
               <Text style={styles.currency}>₹</Text>
               <Text style={styles.price}>{item.priceYear.replace('₹', '')}</Text>
               <Text style={styles.perYear}>/year</Text>
            </View>
            <Text style={styles.monthlyText}>or {item.priceMonth}/mo</Text>

            {/* Features List */}
            <View style={styles.featureList}>
               {item.features.map((feat: any, i: number) => (
                 <View key={i} style={styles.featureRow}>
                    <MaterialCommunityIcons 
                      name={feat.icon} 
                      size={20} 
                      color={feat.active ? (item.textColor || '#fff') : 'rgba(255,255,255,0.4)'} 
                    />
                    <Text style={[
                      styles.featureText, 
                      { color: item.textColor || '#fff', opacity: feat.active ? 1 : 0.5, textDecorationLine: feat.active ? 'none' : 'line-through' }
                    ]}>
                      {feat.text}
                    </Text>
                 </View>
               ))}
            </View>

            {/* Button */}
            <TouchableOpacity style={styles.btn} activeOpacity={0.8}>
               <Text style={[styles.btnText, { color: item.gradient[0] }]}>
                 {item.isGold ? 'JOIN THE ELITE' : 'GET PREMIUM'}
               </Text>
            </TouchableOpacity>

          </LinearGradient>
        </Animated.View>
      </View>
    );
  };

  const renderCompareRow = (row: any, i: number) => (
    <View key={i} style={[styles.compRow, i % 2 !== 0 && styles.compRowAlt]}>
      <View style={{flex: 1.5, flexDirection: 'row', alignItems: 'center'}}>
         <MaterialCommunityIcons name={row.icon} size={18} color="#555" style={{marginRight: 8}} />
         <Text style={styles.compLabel}>{row.label}</Text>
      </View>
      {row.vals.map((isActive: boolean, idx: number) => (
        <View key={idx} style={{flex: 1, alignItems: 'center'}}>
           {isActive ? (
             <Ionicons name="checkmark-circle" size={20} color="#00C853" />
           ) : (
             <Text style={{color: '#DDD'}}>-</Text>
           )}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      {/* --- BACKGROUND PATTERN --- */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
         <FloatingIcon name="star" size={100} top={50} left={-20} delay={0} color="#FFD700" />
         <FloatingIcon name="crown" size={80} top={250} right={-20} delay={1000} color="#654ea3" />
         <FloatingIcon name="shield-checkmark" size={90} bottom={200} left={20} delay={500} />
      </View>

      {/* --- HEADER --- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
           <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Unlock Premium</Text>
        <View style={{width: 40}} /> 
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.headline}>Choose the plan that{'\n'}suits you best.</Text>

        {/* --- CAROUSEL --- */}
        <Animated.FlatList
          data={PLANS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={width}
          decelerationRate="fast"
          contentContainerStyle={{ paddingBottom: 20 }}
          keyExtractor={item => item.id}
          renderItem={renderPlanCard}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
        />

        {/* --- DOTS INDICATOR --- */}
        <View style={styles.dotsContainer}>
           {PLANS.map((_, i) => {
             const opacity = scrollX.interpolate({
               inputRange: [(i - 1) * width, i * width, (i + 1) * width],
               outputRange: [0.3, 1, 0.3],
               extrapolate: 'clamp'
             });
             return <Animated.View key={i} style={[styles.dot, { opacity }]} />;
           })}
        </View>

        {/* --- COMPARISON TABLE --- */}
        <View style={styles.compareSection}>
          <Text style={styles.compareTitle}>Compare Features</Text>
          
          <View style={styles.compareCard}>
            {/* Table Header */}
            <View style={styles.compHeader}>
              <View style={{flex: 1.5}} />
              <Text style={[styles.compHeadText, {color: '#4481EB'}]}>Con</Text>
              <Text style={[styles.compHeadText, {color: '#654ea3'}]}>Asst</Text>
              <Text style={[styles.compHeadText, {color: '#FF416C'}]}>Fam</Text>
              <Text style={[styles.compHeadText, {color: '#FDB931'}]}>Gold</Text>
            </View>
            
            {COMPARE_ROWS.map(renderCompareRow)}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FC' }, // Clean Off-White
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEE', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  headline: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: '#1A1A1A', marginVertical: 10 },

  // CARD STYLES
  cardContainer: {
    width: CARD_WIDTH,
    height: 520,
    borderRadius: 30,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  cardGradient: {
    flex: 1,
    borderRadius: 30,
    padding: 25,
    justifyContent: 'space-between'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planSub: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1 },
  planName: { fontSize: 32, fontWeight: '800', color: '#fff' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },

  priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  currency: { fontSize: 24, fontWeight: '600', color: '#fff', marginRight: 2 },
  price: { fontSize: 48, fontWeight: '900', color: '#fff' },
  perYear: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginLeft: 5 },
  monthlyText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: -5 },

  featureList: { marginTop: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureText: { fontSize: 15, fontWeight: '600', marginLeft: 12 },

  btn: { backgroundColor: '#fff', paddingVertical: 15, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  btnText: { fontSize: 16, fontWeight: '900' },

  // DOTS
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0056D2', marginHorizontal: 4 },

  // COMPARE TABLE
  compareSection: { padding: 20 },
  compareTitle: { fontSize: 20, fontWeight: '700', marginBottom: 15, textAlign: 'center', color: '#333' },
  compareCard: { backgroundColor: '#fff', borderRadius: 20, padding: 15, elevation: 2 },
  
  compHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#EEE', paddingBottom: 10, marginBottom: 5 },
  compHeadText: { flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: 12 },
  
  compRow: { flexDirection: 'row', paddingVertical: 12, alignItems: 'center' },
  compRowAlt: { backgroundColor: '#F9F9F9', marginHorizontal: -15, paddingHorizontal: 15 },
  compLabel: { fontSize: 12, fontWeight: '600', color: '#444' }
});