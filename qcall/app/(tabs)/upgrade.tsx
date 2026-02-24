import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Easing, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🟢 IMPORTING YOUR CENTRALIZED CONFIG
import { API_BASE_URL } from '../../constants/config';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85; 

// Cache configuration
const CACHE_KEY = '@cached_plans';
const CACHE_TIME_KEY = '@plans_sync_time';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// --- FLOATING ICON COMPONENT ---
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

// --- STATIC COMPARE DATA ---
const COMPARE_ROWS = [
  { label: 'Ad-Free Experience', icon: 'advertisement-off', vals: [true, true, true] },
  { label: 'Adv. Spam Block', icon: 'shield-check', vals: [false, true, true] },
  { label: 'Who Viewed Me', icon: 'eye', vals: [false, false, true] },
  { label: 'Gold Caller ID', icon: 'star', vals: [false, false, true] },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  // 🟢 1-WEEK CACHE LOGIC
  const loadPlans = async () => {
    try {
      const cachedPlans = await AsyncStorage.getItem(CACHE_KEY);
      const lastSync = await AsyncStorage.getItem(CACHE_TIME_KEY);
      const now = Date.now();

      // Check if we have cached data AND it is less than 1 week old
      if (cachedPlans && lastSync && (now - parseInt(lastSync) < ONE_WEEK_MS)) {
        console.log("⚡ Loading Plans from Local Cache");
        setPlans(JSON.parse(cachedPlans));
        setLoading(false);
        // Silently fetch in background to keep cache fresh for next time
        fetchPlansFromAPI(true); 
        return;
      }

      console.log("🕒 Cache expired or missing. Fetching Plans from Database...");
      await fetchPlansFromAPI(false);

    } catch (error) {
      console.log("Cache Read Error:", error);
      await fetchPlansFromAPI(false);
    }
  };

  // 🟢 DIRECT SECURE FETCH USING YOUR CONFIG URL AND JWT TOKEN
  const fetchPlansFromAPI = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setErrorMsg(null);

      // 1. Retrieve the JWT Token from AsyncStorage
      const token = await AsyncStorage.getItem('token'); 

      if (!token) {
        throw new Error("No authorization token found. Please log in again.");
      }

      const targetUrl = `${API_BASE_URL}/plans`;
      console.log("Fetching secure plans from:", targetUrl);

      // 2. Attach the token to the Headers
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}` // 🔒 JWT Middleware Auth
        }
      });
      
      if (!response.ok) {
        // If still 401, the token might be expired
        if (response.status === 401) {
            throw new Error(`Session expired or unauthorized (401).`);
        }
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result && result.success && result.data && result.data.length > 0) {
        setPlans(result.data);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result.data));
        await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } else {
        setErrorMsg("Connected to server, but zero active plans were found.");
        console.log("⚠️ API returned:", result);
      }
    } catch (error: any) {
      console.log("🔴 API Fetch Error:", error?.message || error);
      if (!isBackground) {
        setErrorMsg(`Failed to load plans: ${error?.message}`);
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // --- DYNAMIC RENDER PLAN CARD WITH CAROUSEL ANIMATION ---
  const renderPlanCard = ({ item, index }: { item: any, index: number }) => {
    
    // The "Card Moving Layout" Math
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const scale = scrollX.interpolate({ inputRange, outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' });
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.7, 1, 0.7], extrapolate: 'clamp' });

    // Dynamic Styling based on features
    const isGold = item.plan_name.toLowerCase().includes('gold') || item.features?.includes('golden_caller_id');
    const gradientColors = isGold ? ['#FFD700', '#FDB931'] : ['#4481EB', '#04BEFE'];
    const textColor = isGold ? '#000000' : '#FFFFFF';

    return (
      <View style={{ width: width, alignItems: 'center', paddingTop: 20 }}>
        <Animated.View style={[styles.cardContainer, { transform: [{ scale }], opacity }]}>
          
          <LinearGradient 
            colors={gradientColors as [string, string]} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            style={styles.cardGradient}
          >
            
            <View style={styles.cardHeader}>
               <View>
                 <Text style={[styles.planSub, { color: isGold ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)' }]}>
                    {item.duration_days} DAYS
                 </Text>
                 <Text style={[styles.planName, { color: textColor }]}>{item.plan_name}</Text>
               </View>
               <View style={styles.iconCircle}>
                 <MaterialCommunityIcons name="crown" size={24} color={isGold ? '#DAA520' : gradientColors[0]} />
               </View>
            </View>

            <View style={styles.priceContainer}>
               <Text style={[styles.currency, { color: textColor }]}>₹</Text>
               <Text style={[styles.price, { color: textColor }]}>{item.price}</Text>
               {item.price > 0 && <Text style={[styles.perYear, { color: textColor, opacity: 0.8 }]}>/total</Text>}
            </View>

            <View style={styles.featureList}>
               {item.features?.length > 0 ? (
                 item.features.map((featKey: string, i: number) => {
                   const formatText = featKey.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                   return (
                     <View key={i} style={styles.featureRow}>
                        <MaterialCommunityIcons name="check-decagram" size={20} color={textColor} />
                        <Text style={[styles.featureText, { color: textColor }]}>{formatText}</Text>
                     </View>
                   );
                 })
               ) : (
                 <View style={styles.featureRow}>
                    <Text style={[styles.featureText, { color: textColor, fontStyle: 'italic' }]}>Basic Calling Features</Text>
                 </View>
               )}
            </View>

            <TouchableOpacity style={[styles.btn, isGold ? { backgroundColor: '#000' } : { backgroundColor: '#FFF' }]} activeOpacity={0.8}>
               <Text style={[styles.btnText, { color: isGold ? '#FFD700' : gradientColors[0] }]}>
                 {item.price === 0 ? 'CURRENT PLAN' : 'UPGRADE NOW'}
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
      
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
         <FloatingIcon name="star" size={100} top={50} left={-20} delay={0} color="#FFD700" />
         <FloatingIcon name="crown" size={80} top={250} right={-20} delay={1000} color="#654ea3" />
         <FloatingIcon name="shield-checkmark" size={90} bottom={200} left={20} delay={500} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
           <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Unlock Premium</Text>
        <View style={{width: 40}} /> 
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>Choose the plan that{'\n'}suits you best.</Text>

        {loading ? (
          <View style={{ height: 520, justifyContent: 'center', alignItems: 'center' }}>
             <ActivityIndicator size="large" color="#4481EB" />
             <Text style={{ marginTop: 10, color: '#555', fontWeight: 'bold' }}>Loading Plans...</Text>
          </View>
        ) : errorMsg ? (
          <View style={{ height: 520, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
             <Ionicons name="warning-outline" size={48} color="#EF4444" />
             <Text style={{ marginTop: 10, color: '#EF4444', fontWeight: 'bold', textAlign: 'center' }}>{errorMsg}</Text>
             <TouchableOpacity onPress={() => fetchPlansFromAPI()} style={[styles.btn, {backgroundColor: '#EF4444', marginTop: 20, paddingHorizontal: 20}]}>
                 <Text style={{color: '#FFF', fontWeight: 'bold'}}>Retry Connection</Text>
             </TouchableOpacity>
          </View>
        ) : (
          <>
            <Animated.FlatList
              data={plans}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={width}
              decelerationRate="fast"
              contentContainerStyle={{ paddingBottom: 20 }}
              keyExtractor={(item) => item._id || Math.random().toString()}
              renderItem={renderPlanCard}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: true }
              )}
            />

            <View style={styles.dotsContainer}>
               {plans.map((_, i) => {
                 const opacity = scrollX.interpolate({
                   inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                   outputRange: [0.3, 1, 0.3],
                   extrapolate: 'clamp'
                 });
                 return <Animated.View key={i} style={[styles.dot, { opacity }]} />;
               })}
            </View>
          </>
        )}

        {/* Hide Comparison Table if no plans loaded */}
        {!loading && !errorMsg && plans.length > 0 && (
            <View style={styles.compareSection}>
            <Text style={styles.compareTitle}>Compare Features</Text>
            <View style={styles.compareCard}>
                <View style={styles.compHeader}>
                <View style={{flex: 1.5}} />
                {plans.map((p, index) => (
                    <Text key={index} style={[styles.compHeadText, {color: p.plan_name.toLowerCase().includes('gold') ? '#FDB931' : '#4481EB'}]}>
                        {p.plan_name.substring(0, 4)}
                    </Text>
                ))}
                </View>
                {COMPARE_ROWS.map(renderCompareRow)}
            </View>
            </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FC' }, 
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEE', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  headline: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: '#1A1A1A', marginVertical: 10 },

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
  planSub: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  planName: { fontSize: 32, fontWeight: '800' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },

  priceContainer: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  currency: { fontSize: 24, fontWeight: '600', marginRight: 2 },
  price: { fontSize: 48, fontWeight: '900' },
  perYear: { fontSize: 16, marginLeft: 5 },

  featureList: { marginTop: 20, flex: 1 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureText: { fontSize: 16, fontWeight: '700', marginLeft: 12 },

  btn: { paddingVertical: 15, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  btnText: { fontSize: 16, fontWeight: '900' },

  dotsContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0056D2', marginHorizontal: 4 },

  compareSection: { padding: 20 },
  compareTitle: { fontSize: 20, fontWeight: '700', marginBottom: 15, textAlign: 'center', color: '#333' },
  compareCard: { backgroundColor: '#fff', borderRadius: 20, padding: 15, elevation: 2 },
  
  compHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#EEE', paddingBottom: 10, marginBottom: 5 },
  compHeadText: { flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: 12 },
  
  compRow: { flexDirection: 'row', paddingVertical: 12, alignItems: 'center' },
  compRowAlt: { backgroundColor: '#F9F9F9', marginHorizontal: -15, paddingHorizontal: 15 },
  compLabel: { fontSize: 12, fontWeight: '600', color: '#444' }
});