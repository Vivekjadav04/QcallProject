import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, SectionList, TouchableOpacity, Platform, 
  PermissionsAndroid, Image, TextInput, NativeModules, 
  RefreshControl, Linking, Animated, Dimensions, Easing, Modal
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { StatusBar } from 'expo-status-bar'; 
import { LinearGradient } from 'expo-linear-gradient';

// @ts-ignore
import CallLogs from 'react-native-call-log';
import * as Contacts from 'expo-contacts'; 
import { useRouter, useFocusEffect } from 'expo-router';

import { useAuth } from '../../hooks/useAuth'; 
import { CallService } from '../../services/CallService'; 
import { SyncService } from '../../services/SyncService'; 
import { apiService } from '../../services/api'; 
import DialerModal from '../../components/DialerModal'; 
import { useCustomAlert } from '../../context/AlertContext';

const { CallManagerModule } = NativeModules;
const { width } = Dimensions.get('window'); // 🟢 Added Width for Ad Calculation
const BATCH_SIZE = 40; 

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
    skeleton: '#E2E8F0' 
  }
};

// 🟢 AD IMAGES CONSTANT
const AD_IMAGES = [
  'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&q=80',
  'https://images.unsplash.com/photo-1573806119002-3b145202636a?w=500&q=80',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&q=80',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&q=80',
];

// 🟢 NEW SCROLLING AD COMPONENT
const ScrollingAdBanner = () => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const itemWidth = width * 0.75;

  useEffect(() => {
    const totalScrollWidth = itemWidth * AD_IMAGES.length;
    
    const startScroll = () => {
      scrollX.setValue(0);
      Animated.loop(
        Animated.timing(scrollX, {
          toValue: -totalScrollWidth,
          duration: 25000, 
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    };
    startScroll();
  }, [scrollX]);

  return (
    <View style={styles.adBannerWrapper}>
      <View style={styles.adHeaderRow}>
        <View style={styles.adLabelBox}><Text style={styles.adLabelText}>Ad</Text></View>
        <Text style={styles.adBrandText}>Google Ads Sponsored</Text>
      </View>
      
      <View style={styles.adClipContainer}>
        <Animated.View style={[styles.adScrollRow, { transform: [{ translateX: scrollX }] }]}>
          {[...AD_IMAGES, ...AD_IMAGES].map((uri, idx) => (
            <View key={idx} style={[styles.adImageWrapper, { width: itemWidth }]}>
              <Image source={{ uri }} style={styles.adImage} />
            </View>
          ))}
        </Animated.View>
      </View>

      <TouchableOpacity style={styles.adCtaBtn} activeOpacity={0.8} onPress={() => Linking.openURL('https://google.com')}>
        <Text style={styles.adCtaText}>Visit Store</Text>
        <Feather name="external-link" size={12} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

// ... (Rest of your existing helper functions: getLast10, getAvatarStyle, formatTime, getDayLabel, SkeletonCallLog) ...
const getLast10 = (num: string) => {
  if (!num) return '';
  return num.replace(/\D/g, '').slice(-10);
};

const getAvatarStyle = (name: string) => {
  const bgColors = ['#F3F4F6', '#ECFEFF', '#F0FDF4', '#FFF7ED', '#FEF2F2', '#F5F3FF', '#EFF6FF', '#FFFBEB'];
  const textColors = ['#374151', '#0E7490', '#15803D', '#C2410C', '#B91C1C', '#7C3AED', '#1D4ED8', '#B45309'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % bgColors.length;
  return { backgroundColor: bgColors[index], color: textColors[index] };
};

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
      <Animated.View style={[styles.squircleAvatar, { backgroundColor: THEME.colors.skeleton, opacity }]} />
      <View style={styles.cardContent}>
        <Animated.View style={{ width: '60%', height: 16, backgroundColor: THEME.colors.skeleton, borderRadius: 4, marginBottom: 8, opacity }} />
        <Animated.View style={{ width: '40%', height: 12, backgroundColor: THEME.colors.skeleton, borderRadius: 4, opacity }} />
      </View>
      <Animated.View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: THEME.colors.skeleton, marginLeft: 10, opacity }} />
    </View>
  );
};

// --- HEADER COMPONENT (Standardized) ---
const HeaderComponent = React.memo(({ searchText, setSearchText, userPhoto, onProfilePress, onFilterPress, currentFilter }: any) => {
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
                <Feather name="user" size={24} color="#FFF" />
             </View>
           )}
        </TouchableOpacity>
      </View>
      <View style={styles.searchBlock}>
        <Feather name="search" size={18} color={THEME.colors.textSub} />
        <TextInput 
          placeholder="Search logs..." 
          placeholderTextColor={THEME.colors.textSub} 
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText} 
        />
        <TouchableOpacity style={[styles.filterIcon, currentFilter !== 'All' && {backgroundColor: '#DBEAFE'}]} onPress={onFilterPress}>
            <Feather name="filter" size={18} color={currentFilter !== 'All' ? '#2563EB' : THEME.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 🟢 INSERTED: Auto-Scrolling Ad Component */}
      <ScrollingAdBanner />
    </View>
  );
});

// ... (Rest of your original code: CallLogItem, CallLogScreen logic, and styles) ...
// NOTE: I am pasting the rest exactly as it was, with ONLY the new ad styles added at the bottom.

const CallLogItem = React.memo(({ item, index, onCallPress, onRowPress }: any) => {
  const isMissed = item.type === 'missed';
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const getIcon = () => {
    if (item.type === 'missed') return <MaterialCommunityIcons name="phone-missed" size={16} color={THEME.colors.danger} />;
    if (item.type === 'incoming') return <MaterialCommunityIcons name="phone-incoming" size={16} color={THEME.colors.success} />;
    return <MaterialCommunityIcons name="phone-outgoing" size={16} color={THEME.colors.textSub} />;
  };

  const displayName = item.name || item.number || '?';
  const avatarStyle = getAvatarStyle(displayName);

  return (
    <Animated.View style={{ opacity: anim }}>
      <TouchableOpacity style={styles.cardItem} activeOpacity={0.7} onPress={() => onRowPress(item)}>
        <View style={[styles.squircleAvatar, isMissed ? styles.missedAvatarBg : (!item.imageUri ? { backgroundColor: avatarStyle.backgroundColor } : {})]}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.realAvatar} />
          ) : (
            <Text style={[styles.avatarText, isMissed ? { color: THEME.colors.danger } : { color: avatarStyle.color }]}>
                {displayName[0].toUpperCase()}
            </Text>
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
            <Ionicons name="call" size={20} color="#FFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function CallLogScreen() {
  const router = useRouter(); 
  const insets = useSafeAreaInsets();
  const { user } = useAuth(); 
  const { showAlert } = useCustomAlert();
  
  const [masterLogs, setMasterLogs] = useState<any[]>([]); 
  const [contactMap, setContactMap] = useState<Map<string, any>>(new Map());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(BATCH_SIZE);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [filterType, setFilterType] = useState<'All' | 'Missed' | 'Incoming' | 'Outgoing'>('All');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [dialerVisible, setDialerVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    const initSync = async () => {
      const isAuthenticated = await apiService.isAuthenticated();
      if (isAuthenticated) SyncService.startSync();
    };
    initSync();
  }, []);

  const loadContacts = async () => {
    try {
        const { status } = await Contacts.requestPermissionsAsync();
        if(status === 'granted') {
            const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image] });
            const map = new Map();
            data.forEach((c: any) => c.phoneNumbers?.forEach((p: any) => {
              if(p.number) {
                  const key = getLast10(p.number);
                  map.set(key, { id: c.id, name: c.name, image: c.image?.uri });
              }
            }));
            setContactMap(map);
            return map; 
        }
    } catch(e) { console.log(e); }
    return new Map(); 
  };

  const loadData = async (limit: number, currentMap: Map<string, any> | null = null, isRefresh = false) => {
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

      const rawLogs = await CallLogs.load(limit);
      if (rawLogs.length < limit) setHasMoreLogs(false);

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

      const mapToUse = currentMap || contactMap;
      const normalized = grouped.map((log: any, index: number) => {
        const cleanNum = getLast10(log.phoneNumber);
        const contactInfo = mapToUse.get(cleanNum); 
        return {
            id: index.toString(),
            contactId: contactInfo?.id || null, 
            name: contactInfo?.name || log.name || null,
            imageUri: contactInfo?.image,
            number: log.phoneNumber,
            type: log.type.toLowerCase(),
            timestamp: parseInt(log.timestamp),
            time: formatTime(parseInt(log.timestamp)),
            sim: "SIM 1",
            count: log.count
        };
      });
      setMasterLogs(normalized);
    } catch (e) { console.error("Log Error:", e); } 
    finally {
      setIsInitialLoading(false);
      setIsLoadingMore(false);
      if(isRefresh) setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        const loadedMap = await loadContacts(); 
        if (Platform.OS === 'android') {
          const hasLogPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
          if (hasLogPerm) loadData(displayLimit, loadedMap); 
          else {
             setPermissionGranted(false);
             setIsInitialLoading(false);
          }
        } else {
          loadData(displayLimit, loadedMap);
        }
      };
      init();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setDisplayLimit(BATCH_SIZE); 
    setHasMoreLogs(true);
    const loadedMap = await loadContacts(); 
    loadData(BATCH_SIZE, loadedMap, true);
  };

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
           const loadedMap = await loadContacts();
           loadData(BATCH_SIZE, loadedMap);
         } else {
           showAlert("Permission Denied", "We cannot show your call history without permission.", "error");
         }
       } catch (e) { console.error(e); }
    }
  };

  const handleNativeCall = useCallback(async (name: string | null, number: string) => {
    const cleanNumber = number.replace(/[^\d+]/g, ''); 
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
            showAlert("Error", "Could not initiate call.", "error");
        }
    } else {
        Linking.openURL(`tel:${cleanNumber}`);
    }
  }, [router]);

  const handleRowPress = useCallback((item: any) => {
      if (item.contactId) {
          // @ts-ignore
          router.push({
              pathname: '/contact_details', 
              params: { contactId: item.contactId, phoneNumber: item.number }
          });
      } else {
          router.push({
              pathname: '/caller-id/view-profile', 
              params: { number: item.number }
          });
      }
  }, [router]);

  const sections = useMemo(() => {
    let result = masterLogs;
    if (searchText) {
        result = result.filter(log => log.number.includes(searchText) || (log.name && log.name.toLowerCase().includes(searchText.toLowerCase())));
    }
    if (filterType !== 'All') {
        const typeKey = filterType.toLowerCase(); 
        result = result.filter(log => log.type === typeKey);
    }
    if (!result.length && !isInitialLoading) return [];

    const groups: any = { 'Today': [], 'Yesterday': [] };
    const otherKeys: string[] = [];
    result.forEach(log => {
        const label = getDayLabel(log.timestamp);
        if(label === 'Today' || label === 'Yesterday') groups[label].push(log);
        else {
            if(!groups[label]) { groups[label] = []; otherKeys.push(label); }
            groups[label].push(log);
        }
    });

    return [
        { title: 'Today', data: groups['Today'] }, 
        { title: 'Yesterday', data: groups['Yesterday'] },
        ...otherKeys.map(k => ({ title: k, data: groups[k] }))
    ].filter(s => s.data && s.data.length > 0);
  }, [masterLogs, searchText, filterType, isInitialLoading]);

  const renderFooter = () => {
    if (!isLoadingMore) return <View style={{ height: 100 }} />;
    return (
      <View style={{ paddingBottom: 100 }}>
        <SkeletonCallLog />
        <SkeletonCallLog />
      </View>
    );
  };

  if (isInitialLoading && masterLogs.length === 0) {
    return (
      <View style={styles.container}>
         <SafeAreaView style={{ flex: 1 }} edges={['top']}>
           <HeaderComponent searchText={searchText} setSearchText={setSearchText} userPhoto={user?.profilePhoto} />
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
           onFilterPress={() => setShowFilterModal(true)}
           currentFilter={filterType}
        />
        
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
          renderItem={({item, index}) => (
            <CallLogItem 
                item={item} 
                index={index} 
                onCallPress={handleNativeCall} 
                onRowPress={handleRowPress} 
            />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text></View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} 
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.colors.primary} />}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5} 
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
             <View style={styles.emptyState}>
                <Feather name="phone-off" size={40} color="#CBD5E1" />
                <Text style={styles.emptyText}>{permissionGranted ? `No ${filterType !== 'All' ? filterType.toLowerCase() : ''} calls` : "Permission needed"}</Text>
             </View>
          }
        />

        {/* FAB Buttons */}
        <TouchableOpacity 
          style={[styles.fab, { bottom: insets.bottom + 190, backgroundColor: '#3B82F6' }]} 
          onPress={() => router.push('/search')}
          activeOpacity={0.9}
        >
          <View style={styles.fabContent}>
             <Feather name="search" size={26} color="#FFF" />
          </View>
        </TouchableOpacity>

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
        
        {/* Filter Modal */}
        <Modal transparent visible={showFilterModal} animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilterModal(false)}>
                <View style={styles.filterModal}>
                    <Text style={styles.filterTitle}>Filter Calls</Text>
                    {['All', 'Missed', 'Incoming', 'Outgoing'].map((type) => (
                        <TouchableOpacity 
                            key={type} 
                            style={[styles.filterOption, filterType === type && styles.filterOptionActive]}
                            onPress={() => { setFilterType(type as any); setShowFilterModal(false); }}
                        >
                            <Text style={[styles.filterText, filterType === type && styles.filterTextActive]}>{type} Calls</Text>
                            {filterType === type && <Feather name="check" size={18} color="#FFF" />}
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  // 🟢 Standardized Header Wrapper: 24px padding
  headerWrapper: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, backgroundColor: THEME.colors.bg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerDate: { fontSize: 13, color: THEME.colors.textSub, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  // 🟢 Standardized Title: 34px
  headerTitle: { fontSize: 34, fontWeight: '900', color: THEME.colors.primary, letterSpacing: -1 },
  profileBtn: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  // 🟢 Standardized Avatar: 48px
  avatarImage: { width: 48, height: 48, borderRadius: 18, borderWidth: 2, borderColor: '#FFF' },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 18, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  
  // 🟢 Standardized Search: 52px height
  searchBlock: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, height: 52, borderRadius: 20, borderWidth: 1, borderColor: THEME.colors.border, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: THEME.colors.textMain, fontWeight: '500' },
  filterIcon: { padding: 8, borderRadius: 12 },
  
  // 🟢 AD COMPONENT STYLES
  adBannerWrapper: {
    backgroundColor: '#FFF',
    marginTop: 20,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  adHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  adLabelBox: { backgroundColor: '#FBBF24', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  adLabelText: { fontSize: 10, fontWeight: '900', color: '#92400E' },
  adBrandText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  adClipContainer: { overflow: 'hidden', height: 80, borderRadius: 12, backgroundColor: '#F8FAFC' },
  adScrollRow: { flexDirection: 'row' },
  adImageWrapper: { height: 80, marginRight: 10, borderRadius: 10, overflow: 'hidden' },
  adImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  adCtaBtn: { marginTop: 10, backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, gap: 6 },
  adCtaText: { color: '#FFF', fontWeight: '800', fontSize: 12 },

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
  fab: { position: 'absolute', right: 20, shadowColor: THEME.colors.primary, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10, borderRadius: 30 },
  fabGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  fabContent: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3B82F6' },
  permErrorBox: { marginHorizontal: 20, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
  permErrorText: { color: '#DC2626', fontWeight: '600', fontSize: 13, marginLeft: 8 },
  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.7 },
  emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 10, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  filterModal: { backgroundColor: '#FFF', width: '80%', borderRadius: 20, padding: 20, elevation: 10 },
  filterTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: THEME.colors.primary },
  filterOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12 },
  filterOptionActive: { backgroundColor: THEME.colors.primary },
  filterText: { fontSize: 16, color: THEME.colors.textMain, fontWeight: '500' },
  filterTextActive: { color: '#FFF', fontWeight: '700' }
});