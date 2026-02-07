import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, SectionList, TouchableOpacity, Platform, 
  PermissionsAndroid, Image, TextInput, NativeModules, 
  RefreshControl, Linking, Animated, Dimensions, Easing
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { StatusBar } from 'expo-status-bar'; 
import { LinearGradient } from 'expo-linear-gradient';

// @ts-ignore
import CallLogs from 'react-native-call-log';
import * as Contacts from 'expo-contacts'; 
import { useRouter, useFocusEffect } from 'expo-router';

// 🟢 Services & Hooks
import { useAuth } from '../../hooks/useAuth'; 
import { CallService } from '../../services/CallService'; 
import { SyncService } from '../../services/SyncService'; 
import { apiService } from '../../services/api'; 
import DialerModal from '../../components/DialerModal'; 
import { useCustomAlert } from '../../context/AlertContext';

const { CallManagerModule } = NativeModules;
const { width } = Dimensions.get('window');

// 🟢 CONFIGURATION
const BATCH_SIZE = 40; // Load 40 items at a time

const THEME = {
  colors: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    primary: '#0F172A',
    textMain: '#1E293B',
    textSub: '#64748B',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    success: '#10B981',
    border: '#E2E8F0',
    skeleton: '#E2E8F0' // Color for skeleton
  }
};

// --- HELPERS ---
const normalizeNumber = (num: string) => num ? num.replace(/[^\d+]/g, '') : '';

const formatTime = (ts: number) => {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } 
  catch { return ''; }
};

const getDayLabel = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// --- 💀 SKELETON COMPONENT (The "Ghost" Loading Screen) ---
const SkeletonCallLog = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, easing: Easing.linear, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={styles.cardItem}>
      {/* Avatar Skeleton */}
      <Animated.View style={[styles.squircleAvatar, { backgroundColor: THEME.colors.skeleton, opacity }]} />
      
      {/* Text Skeleton */}
      <View style={styles.cardContent}>
        <Animated.View style={{ width: '60%', height: 16, backgroundColor: THEME.colors.skeleton, borderRadius: 4, marginBottom: 8, opacity }} />
        <Animated.View style={{ width: '40%', height: 12, backgroundColor: THEME.colors.skeleton, borderRadius: 4, opacity }} />
      </View>

      {/* Button Skeleton */}
      <Animated.View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: THEME.colors.skeleton, marginLeft: 10, opacity }} />
    </View>
  );
};

// --- HEADER COMPONENT ---
const HeaderComponent = React.memo(({ searchText, setSearchText, userPhoto, onProfilePress }: any) => {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={styles.headerWrapper}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.headerDate}>{dateStr}</Text>
          <Text style={styles.headerTitle}>Recents</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={onProfilePress} activeOpacity={0.8}>
           {userPhoto ? (
             <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
           ) : (
             <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={20} color="#FFF" />
             </View>
           )}
        </TouchableOpacity>
      </View>
      <View style={styles.searchBlock}>
        <Feather name="search" size={18} color={THEME.colors.textSub} />
        <TextInput 
          placeholder="Filter logs..." 
          placeholderTextColor={THEME.colors.textSub} 
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText} 
        />
        <TouchableOpacity style={styles.filterIcon}>
            <Feather name="sliders" size={16} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const AdCard = () => (
  <View style={styles.adWrapper}>
    <LinearGradient 
      colors={['#1E293B', '#0F172A']} 
      start={{x:0, y:0}} end={{x:1, y:1}} 
      style={styles.adCard}
    >
        <View>
          <View style={styles.adBadge}><Text style={styles.adBadgeText}>SPONSORED</Text></View>
          <Text style={styles.adTitle}>Upgrade to Pro</Text>
          <Text style={styles.adDesc}>Caller ID & Spam Block.</Text>
        </View>
        <View style={styles.adIconCircle}>
            <Feather name="zap" size={20} color="#FBBF24" />
        </View>
    </LinearGradient>
  </View>
);

const CallLogItem = React.memo(({ item, index, onCallPress }: any) => {
  const isMissed = item.type === 'missed';
  // Simple fade in for new items
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { 
        toValue: 1, duration: 400, useNativeDriver: true 
    }).start();
  }, []);

  const getIcon = () => {
    if (isMissed) return <Feather name="phone-missed" size={14} color={THEME.colors.danger} />;
    if (item.type === 'incoming') return <Feather name="phone-incoming" size={14} color={THEME.colors.success} />;
    return <Feather name="phone-outgoing" size={14} color={THEME.colors.textSub} />;
  };

  return (
    <Animated.View style={{ opacity: anim }}>
      <TouchableOpacity style={styles.cardItem} activeOpacity={0.7} onPress={() => onCallPress(item.name, item.number)}>
        <View style={[styles.squircleAvatar, isMissed && styles.missedAvatarBg]}>
          {!item.imageUri ? (
            <Text style={[styles.avatarText, isMissed && { color: THEME.colors.danger }]}>
                {item.name ? item.name[0].toUpperCase() : '#'}
            </Text>
          ) : (
            <Image source={{ uri: item.imageUri }} style={styles.realAvatar} />
          )}
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
             <Text style={[styles.cardName, isMissed && { color: THEME.colors.danger }]} numberOfLines={1}>
               {item.name || item.number}
             </Text>
             {item.count > 1 && (
                <View style={styles.counterBadge}><Text style={styles.counterText}>({item.count})</Text></View>
             )}
          </View>
          <View style={styles.cardBottomRow}>
             <View style={styles.iconRow}>
                {getIcon()}
                <Text style={styles.cardType}>{item.type}</Text>
             </View>
             <Text style={styles.dotSeparator}>•</Text>
             <Text style={styles.cardTime}>{item.time}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.callBtn} onPress={() => onCallPress(item.name, item.number)}>
           <Ionicons name="call" size={18} color="#FFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
});

// --- MAIN SCREEN ---
export default function CallLogScreen() {
  const router = useRouter(); 
  const insets = useSafeAreaInsets();
  
  const { user } = useAuth(); 
  const { showAlert } = useCustomAlert();
  
  const [masterLogs, setMasterLogs] = useState<any[]>([]); 
  
  // 🟢 Loading States
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // 🟢 Pagination State
  const [displayLimit, setDisplayLimit] = useState(BATCH_SIZE);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);

  const [dialerVisible, setDialerVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    const initSync = async () => {
      const isAuthenticated = await apiService.isAuthenticated();
      if (isAuthenticated) {
        SyncService.startSync();
      }
    };
    initSync();
  }, []);

  // 🟢 Optimized Load Function
  const loadData = async (limit: number, isRefresh = false) => {
    try {
      if (Platform.OS === 'android') {
        const hasPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
        if (!hasPerm) {
          setPermissionGranted(false);
          setIsInitialLoading(false);
          return; 
        }
      }
      setPermissionGranted(true);

      // Fetch logs with the current limit
      const rawLogs = await CallLogs.load(limit);
      
      // If we got fewer logs than requested, we've reached the end
      if (rawLogs.length < limit) {
        setHasMoreLogs(false);
      }

      // Pre-fetch contacts only for numbers we have (optimization)
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image] });
      
      const newMap: any = {};
      data.forEach((c: any) => c.phoneNumbers?.forEach((p: any) => {
        if(p.number) newMap[normalizeNumber(p.number)] = { name: c.name, image: c.image?.uri };
      }));

      // Grouping Logic
      const grouped: any[] = [];
      if(rawLogs.length > 0) {
        let current = { ...rawLogs[0], count: 1 };
        for(let i=1; i<rawLogs.length; i++) {
            const next = rawLogs[i];
            const isSame = next.phoneNumber === current.phoneNumber && next.type === current.type && getDayLabel(parseInt(next.timestamp)) === getDayLabel(parseInt(current.timestamp));
            if(isSame) current.count++;
            else { grouped.push(current); current = { ...next, count: 1 }; }
        }
        grouped.push(current);
      }

      const normalized = grouped.map((log: any, index: number) => ({
        id: index.toString(),
        name: log.name || newMap[normalizeNumber(log.phoneNumber)]?.name || null,
        imageUri: newMap[normalizeNumber(log.phoneNumber)]?.image,
        number: log.phoneNumber,
        type: log.type.toLowerCase(),
        timestamp: parseInt(log.timestamp),
        time: formatTime(parseInt(log.timestamp)),
        sim: "SIM 1",
        count: log.count
      }));
      
      setMasterLogs(normalized);
    } catch (e) { 
      console.error("Log Error:", e); 
    } finally {
      setIsInitialLoading(false);
      setIsLoadingMore(false);
      if(isRefresh) setRefreshing(false);
    }
  };

  // Initial Load
  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        CallService.preloadContacts();
        if (Platform.OS === 'android') {
          const hasLogPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
          if (hasLogPerm) {
             // Reset limit on focus or keep? Let's reload current limit to be fresh
             loadData(displayLimit);
          } else {
             setPermissionGranted(false);
             setIsInitialLoading(false);
          }
        } else {
          loadData(displayLimit);
        }
      };
      init();
    }, [])
  );

  // 🟢 Handle Refresh (Pull down)
  const onRefresh = () => {
    setRefreshing(true);
    setDisplayLimit(BATCH_SIZE); // Reset pagination
    setHasMoreLogs(true);
    loadData(BATCH_SIZE, true);
  };

  // 🟢 Handle Load More (Scroll to bottom)
  const onLoadMore = () => {
    if (!isLoadingMore && hasMoreLogs && !refreshing && !searchText) {
      setIsLoadingMore(true);
      const newLimit = displayLimit + BATCH_SIZE;
      setDisplayLimit(newLimit);
      loadData(newLimit);
    }
  };

  const manualPermissionRequest = async () => {
    if (Platform.OS === 'android') {
       try {
         const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
         if (status === PermissionsAndroid.RESULTS.GRANTED) {
           setIsInitialLoading(true);
           loadData(BATCH_SIZE);
         } else {
           showAlert("Permission Denied", "We cannot show your call history without permission.", "error");
         }
       } catch (e) { console.error(e); }
    }
  };

  const handleNativeCall = useCallback(async (name: string | null, number: string) => {
    const cleanNumber = normalizeNumber(number);
    if (Platform.OS === 'android') {
        try {
            let isDefault = await CallManagerModule.checkIsDefaultDialer().catch(() => false);
            if (!isDefault) {
                showAlert(
                    "Permission Required",
                    "To make calls, QCall must be your default phone app.",
                    "warning",
                    async () => { await CallManagerModule.requestDefaultDialer(); }
                );
                return; 
            }
            CallManagerModule.startCall(cleanNumber);
        } catch (e) {
            showAlert("Error", "Could not initiate call service.", "error");
        }
    } else {
        Linking.openURL(`tel:${cleanNumber}`);
    }
  }, [router]);

  const sections = useMemo(() => {
    // If searching, filter existing logs (don't paginate search results for simplicity in this version)
    let result = masterLogs;
    if (searchText) {
        result = result.filter(log => log.number.includes(searchText) || (log.name && log.name.toLowerCase().includes(searchText.toLowerCase())));
    }
    
    if (!result.length && !isInitialLoading) return [];

    const groups: any = { 'Today': [], 'Yesterday': [] };
    const otherKeys: string[] = [];
    result.forEach(log => {
        const label = getDayLabel(log.timestamp);
        if(label === 'Today' || label === 'Yesterday') {
            groups[label].push(log);
        } else {
            if(!groups[label]) { groups[label] = []; otherKeys.push(label); }
            groups[label].push(log);
        }
    });

    return [
        { title: 'Today', data: groups['Today'] }, 
        { title: 'Yesterday', data: groups['Yesterday'] },
        ...otherKeys.map(k => ({ title: k, data: groups[k] }))
    ].filter(s => s.data && s.data.length > 0);
  }, [masterLogs, searchText, isInitialLoading]);

  // 🟢 Render Logic for Empty/Loading States
  const renderFooter = () => {
    if (!isLoadingMore) return <View style={{ height: 100 }} />;
    return (
      <View style={{ paddingBottom: 100 }}>
        <SkeletonCallLog />
        <SkeletonCallLog />
      </View>
    );
  };

  // 🟢 Initial Skeleton Screen
  if (isInitialLoading && masterLogs.length === 0) {
    return (
      <View style={styles.container}>
         <SafeAreaView style={{ flex: 1 }} edges={['top']}>
           <HeaderComponent searchText={searchText} setSearchText={setSearchText} userPhoto={user?.profilePhoto} />
           <AdCard />
           <View style={{ paddingHorizontal: 20 }}>
              <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Today</Text></View>
              {[1, 2, 3, 4, 5, 6].map((k) => <SkeletonCallLog key={k} />)}
           </View>
         </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        <HeaderComponent 
           searchText={searchText} 
           setSearchText={setSearchText} 
           userPhoto={user?.profilePhoto} 
           onProfilePress={() => router.push('/profile')} 
        />
        
        <AdCard />

        {!permissionGranted && !isInitialLoading && (
            <TouchableOpacity onPress={manualPermissionRequest} style={styles.permErrorBox}>
                <Feather name="alert-triangle" size={16} color="#DC2626" />
                <Text style={styles.permErrorText}>Permission needed. Tap to enable.</Text>
            </TouchableOpacity>
        )}

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          renderItem={({item, index}) => <CallLogItem item={item} index={index} onCallPress={handleNativeCall} />}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text></View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          
          // 🟢 Pagination Props
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.colors.primary} />}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5} // Trigger when 50% from bottom
          ListFooterComponent={renderFooter}
          
          ListEmptyComponent={
             <View style={styles.emptyState}>
                <Feather name="phone-off" size={40} color="#CBD5E1" />
                <Text style={styles.emptyText}>{permissionGranted ? "No recent calls" : "Permission needed"}</Text>
             </View>
          }
        />

        {/* 🟢 1. SEARCH/IDENTIFY BUTTON */}
        <TouchableOpacity 
          style={[styles.fab, { bottom: insets.bottom + 190, backgroundColor: '#3B82F6' }]} 
          onPress={() => router.push('/search')}
          activeOpacity={0.9}
        >
          <View style={styles.fabContent}>
             <Feather name="search" size={26} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* 🟢 2. DIALER BUTTON */}
        <TouchableOpacity 
          style={[styles.fab, { bottom: insets.bottom + 110 }]} 
          onPress={() => setDialerVisible(true)}
          activeOpacity={0.9}
        >
          <LinearGradient colors={[THEME.colors.primary, '#374151']} style={styles.fabGradient}>
            <Ionicons name="keypad" size={26} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>

        <DialerModal visible={dialerVisible} onClose={() => setDialerVisible(false)} masterLogs={masterLogs} onCallPress={handleNativeCall} />
        
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  
  headerWrapper: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerDate: { fontSize: 13, color: THEME.colors.textSub, fontWeight: '600', textTransform: 'uppercase' },
  headerTitle: { fontSize: 32, fontWeight: '800', color: THEME.colors.textMain, letterSpacing: -1 },
  profileBtn: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  avatarImage: { width: 44, height: 44, borderRadius: 16, borderWidth: 2, borderColor: '#FFF' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 16, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  
  searchBlock: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, height: 48, borderRadius: 16, borderWidth: 1, borderColor: THEME.colors.border, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: THEME.colors.textMain, fontWeight: '500' },
  filterIcon: { padding: 4 },

  adWrapper: { paddingHorizontal: 20, marginBottom: 15 },
  adCard: { borderRadius: 20, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  adBadge: { backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 6 },
  adBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  adTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  adDesc: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  adIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  sectionHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },

  cardItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 8, padding: 14, borderRadius: 18, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1, borderWidth: 1, borderColor: '#F1F5F9' },
  squircleAvatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  missedAvatarBg: { backgroundColor: THEME.colors.dangerBg },
  realAvatar: { width: 46, height: 46, borderRadius: 16 },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#64748B' },
  
  cardContent: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardName: { fontSize: 16, fontWeight: '700', color: THEME.colors.textMain },
  counterBadge: { marginLeft: 6 },
  counterText: { fontSize: 12, fontWeight: '500', color: '#94A3B8' },
  
  cardBottomRow: { flexDirection: 'row', alignItems: 'center' },
  iconRow: { flexDirection: 'row', alignItems: 'center' },
  cardType: { fontSize: 12, color: THEME.colors.textSub, textTransform: 'capitalize', marginLeft: 4, fontWeight: '500' },
  dotSeparator: { marginHorizontal: 6, color: '#CBD5E1', fontSize: 10 },
  cardTime: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  callBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 10, shadowColor: THEME.colors.primary, shadowOpacity: 0.3, shadowRadius: 8 },

  // 🟢 FLOATING BUTTON STYLES
  fab: { position: 'absolute', right: 20, shadowColor: THEME.colors.primary, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10, borderRadius: 30 },
  fabGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  fabContent: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3B82F6' },

  permErrorBox: { marginHorizontal: 20, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
  permErrorText: { color: '#DC2626', fontWeight: '600', fontSize: 13, marginLeft: 8 },
  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.7 },
  emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 10, fontWeight: '500' }
});