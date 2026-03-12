import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, SectionList, TouchableOpacity, Platform, 
  PermissionsAndroid, Image, TextInput, NativeModules, 
  RefreshControl, Linking, Animated, Dimensions, Easing, Modal, FlatList
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { StatusBar } from 'expo-status-bar'; 
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// @ts-ignore
import CallLogs from 'react-native-call-log';
import * as Contacts from 'expo-contacts'; 
import { useRouter, useFocusEffect } from 'expo-router';

import { useAuth } from '../../hooks/useAuth'; 
import { CallService } from '../../services/CallService'; 
import { SyncService } from '../../services/SyncService'; 
import { checkAndSyncPremium, forceSyncPremium } from '../../services/PremiumSync'; 
import { apiService } from '../../services/api'; 
import DialerModal from '../../components/DialerModal'; 
import { useCustomAlert } from '../../context/AlertContext';

const { CallManagerModule } = NativeModules;
const { width } = Dimensions.get('window');
const BATCH_SIZE = 40; 

const THEME = {
  colors: {
    bg: '#FFFFFF', // Changed background to white for the classic list look
    card: '#FFFFFF',
    primary: '#0F172A',
    textMain: '#1E293B',
    textSub: '#64748B',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    success: '#10B981',
    border: '#E2E8F0',
    skeleton: '#E2E8F0',
    qcallGreen: '#22C55E' 
  }
};

const AD_IMAGES = [
  'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&q=80',
  'https://images.unsplash.com/photo-1573806119002-3b145202636a?w=500&q=80',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&q=80',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&q=80',
];

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

const InlineAdItem = () => {
  return (
    <View style={styles.inlineAdContainer}>
      <View style={styles.inlineAdImageWrap}>
        <Image source={{ uri: AD_IMAGES[0] }} style={styles.inlineAdImage} />
      </View>
      <View style={styles.inlineAdContent}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 2}}>
           <View style={styles.adLabelBoxMicro}><Text style={styles.adLabelTextMicro}>Ad</Text></View>
           <Text style={styles.inlineAdTitle} numberOfLines={1}>Sponsored Content</Text>
        </View>
        <Text style={styles.inlineAdSub} numberOfLines={1}>Click to learn more about this offer.</Text>
      </View>
      <TouchableOpacity style={styles.inlineAdBtn} onPress={() => Linking.openURL('https://google.com')}>
        <Text style={styles.inlineAdBtnText}>Visit</Text>
      </TouchableOpacity>
    </View>
  );
};

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
      <Animated.View style={[styles.normalAvatar, { backgroundColor: THEME.colors.skeleton, opacity }]} />
      <View style={styles.cardContent}>
        <Animated.View style={{ width: '60%', height: 16, backgroundColor: THEME.colors.skeleton, borderRadius: 4, marginBottom: 8, opacity }} />
        <Animated.View style={{ width: '40%', height: 12, backgroundColor: THEME.colors.skeleton, borderRadius: 4, opacity }} />
      </View>
      <Animated.View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.colors.skeleton, marginLeft: 10, opacity }} />
    </View>
  );
};

const FavoriteItem = React.memo(({ item, onRowPress }: any) => {
  const displayName = item.name || item.number || '?';
  const avatarStyle = getAvatarStyle(displayName);

  return (
    <TouchableOpacity style={styles.favoriteItemContainer} activeOpacity={0.7} onPress={() => onRowPress(item)}>
      <View style={styles.favoriteAvatarWrapper}>
        <View style={[styles.favoriteAvatar, !item.imageUri && { backgroundColor: avatarStyle.backgroundColor }]}>
           {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.favoriteImage} />
           ) : (
              <Text style={[styles.favoriteAvatarText, { color: avatarStyle.color }]}>{displayName[0].toUpperCase()}</Text>
           )}
        </View>
        <View style={styles.qBadgeContainer}>
          <Text style={styles.qBadgeText}>Q</Text>
        </View>
      </View>
      <Text style={styles.favoriteName} numberOfLines={1}>{displayName}</Text>
      <Text style={styles.favoriteNumber} numberOfLines={1}>{item.number || 'Unknown'}</Text>
    </TouchableOpacity>
  );
});

const HeaderComponent = React.memo(({ searchText, setSearchText, userPhoto, onProfilePress, onFilterPress, onScannerPress }: any) => {
  return (
    <View style={styles.headerWrapper}>
      <View style={styles.newHeaderRow}>
        <TouchableOpacity style={styles.profileBtn} onPress={onProfilePress} activeOpacity={0.8}>
           {userPhoto ? (
             <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
           ) : (
             <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={20} color="#FFF" />
             </View>
           )}
        </TouchableOpacity>
        <View style={styles.searchBlock}>
          <Text style={styles.qcallLogoText}>Qcall</Text>
          <TextInput 
            placeholder="" 
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText} 
          />
          <Feather name="search" size={20} color={THEME.colors.textMain} />
        </View>
        <TouchableOpacity style={styles.headerActionBtn} onPress={onScannerPress}>
           <MaterialCommunityIcons name="qrcode-scan" size={24} color={THEME.colors.textMain} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerActionBtn} onPress={onFilterPress}>
           <MaterialCommunityIcons name="dots-vertical" size={26} color={THEME.colors.textMain} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const CallLogItem = React.memo(({ item, index, onCallPress, onRowPress, isFavorite, toggleFavorite }: any) => {
  
  if (item.isAd) {
    return <InlineAdItem />;
  }

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
        <View style={[styles.normalAvatar, isMissed ? styles.missedAvatarBg : (!item.imageUri ? { backgroundColor: avatarStyle.backgroundColor } : {})]}>
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
        
        <TouchableOpacity style={styles.heartBtn} onPress={() => toggleFavorite(item)}>
            <MaterialCommunityIcons 
               name={isFavorite ? "heart" : "heart-outline"} 
               size={22} 
               color={isFavorite ? THEME.colors.danger : "#CBD5E1"} 
            />
        </TouchableOpacity>

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
  
  const [activeTab, setActiveTab] = useState<'home' | 'favorite'>('home');
  const [favoritesList, setFavoritesList] = useState<any[]>([]); 
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]); 

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
  const [hasNoAds, setHasNoAds] = useState(false);

  useEffect(() => {
    const checkPremiumStatus = async () => {
      const hasFeature = user?.subscription?.activeFeatures?.includes('no_ads');
      const isLegacyPremium = user?.accountType === 'gold' || user?.accountType === 'platinum';
      const cachedFeatures = await AsyncStorage.getItem('@active_features');
      const cachedHasFeature = cachedFeatures ? cachedFeatures.includes('no_ads') : false;

      if (hasFeature || isLegacyPremium || cachedHasFeature) {
        setHasNoAds(true);
      } else {
        setHasNoAds(false);
      }
    };
    checkPremiumStatus();
  }, [user]);

  useEffect(() => {
    const initSync = async () => {
      const isAuthenticated = await apiService.isAuthenticated();
      if (isAuthenticated && user) {
        if(SyncService.startSync) SyncService.startSync();
        checkAndSyncPremium(user);
      }
    };
    initSync();
  }, [user]);

  const loadContactsAndFavorites = async () => {
    try {
        const { status } = await Contacts.requestPermissionsAsync();
        if(status === 'granted') {
            const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image] });
            const map = new Map();
            const savedFavs = await AsyncStorage.getItem('@qcall_favorites');
            const favIds = savedFavs ? JSON.parse(savedFavs) : [];
            const favsArray: any[] = [];

            data.forEach((c: any) => {
              c.phoneNumbers?.forEach((p: any) => {
                if(p.number) {
                    const key = getLast10(p.number);
                    map.set(key, { id: c.id, name: c.name, image: c.image?.uri });
                }
              });

              if (c.name && c.phoneNumbers && c.phoneNumbers.length > 0) {
                  if (favIds.includes(c.id) || c.isStarred) {
                     favsArray.push({ id: c.id, name: c.name, number: c.phoneNumbers[0].number, imageUri: c.image?.uri });
                     if(!favIds.includes(c.id)) favIds.push(c.id); 
                  }
              }
            });

            setFavoriteIds(favIds);
            setContactMap(map);
            setFavoritesList(favsArray); 
            return map; 
        }
    } catch(e) { console.log("Contacts Error:", e); }
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
        const loadedMap = await loadContactsAndFavorites(); 
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
    if (user) await forceSyncPremium();
    setDisplayLimit(BATCH_SIZE); 
    setHasMoreLogs(true);
    const loadedMap = await loadContactsAndFavorites(); 
    loadData(BATCH_SIZE, loadedMap, true);
  };

  const onLoadMore = () => {
    if (!isLoadingMore && hasMoreLogs && !refreshing && !searchText && activeTab === 'home') {
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
           const loadedMap = await loadContactsAndFavorites();
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

  const toggleFavorite = useCallback(async (item: any) => {
      if (!item.contactId) {
          showAlert("Contact Not Saved", "You can only favorite saved contacts.", "warning");
          return;
      }
      
      let updatedFavs = [...favoriteIds];
      if (updatedFavs.includes(item.contactId)) {
          updatedFavs = updatedFavs.filter(id => id !== item.contactId);
      } else {
          updatedFavs.push(item.contactId);
      }
      
      setFavoriteIds(updatedFavs);
      await AsyncStorage.setItem('@qcall_favorites', JSON.stringify(updatedFavs));
      
      loadContactsAndFavorites(); 
  }, [favoriteIds]);

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
    
    let adCounter = 0;

    result.forEach(log => {
        const label = getDayLabel(log.timestamp);
        if (!groups[label]) {
            groups[label] = [];
            if(label !== 'Today' && label !== 'Yesterday') otherKeys.push(label);
        }
        
        groups[label].push(log);
        adCounter++;

        if (!hasNoAds && adCounter % 5 === 0) {
            groups[label].push({ isAd: true, id: `ad-${log.id}` });
        }
    });

    return [
        { title: 'Today', data: groups['Today'] }, 
        { title: 'Yesterday', data: groups['Yesterday'] },
        ...otherKeys.map(k => ({ title: k, data: groups[k] }))
    ].filter(s => s.data && s.data.length > 0);
  }, [masterLogs, searchText, filterType, isInitialLoading, hasNoAds]);

  const renderFooter = () => {
    if (!isLoadingMore) return <View style={{ height: 100 }} />;
    return (
      <View style={{ paddingBottom: 100 }}>
        <SkeletonCallLog />
        <SkeletonCallLog />
      </View>
    );
  };

  const renderTabsHeader = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity 
         style={[styles.tabButton, activeTab === 'home' && styles.activeTabButton]} 
         onPress={() => setActiveTab('home')}
      >
        <MaterialCommunityIcons name="history" size={22} color={activeTab === 'home' ? '#2563EB' : THEME.colors.textSub} style={{marginRight: 6}} />
        <Text style={[styles.tabText, activeTab === 'home' && styles.activeTabText]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity 
         style={[styles.tabButton, activeTab === 'favorite' && styles.activeTabButton]} 
         onPress={() => setActiveTab('favorite')}
      >
        <MaterialCommunityIcons name={activeTab === 'favorite' ? "heart" : "heart-outline"} size={22} color={activeTab === 'favorite' ? '#2563EB' : THEME.colors.textSub} style={{marginRight: 6}} />
        <Text style={[styles.tabText, activeTab === 'favorite' && styles.activeTabText]}>Favorite</Text>
      </TouchableOpacity>
    </View>
  );

  // Define Filter Options for the Bottom Sheet Modal
  const filterOptions = [
    { type: 'All', icon: 'phone-in-talk', color: '#3B82F6' },
    { type: 'Missed', icon: 'phone-missed', color: THEME.colors.danger },
    { type: 'Incoming', icon: 'phone-incoming', color: THEME.colors.success },
    { type: 'Outgoing', icon: 'phone-outgoing', color: THEME.colors.textSub }
  ];

  if (isInitialLoading && masterLogs.length === 0) {
    return (
      <View style={styles.container}>
         <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }} edges={['top']}>
           <HeaderComponent 
              searchText={searchText} 
              setSearchText={setSearchText} 
              userPhoto={user?.profilePhoto} 
              onScannerPress={() => router.push('/scanner')} 
           />
           {renderTabsHeader()}
           <View style={{ paddingHorizontal: 0 }}>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }} edges={['top']}>
        
        <HeaderComponent 
           searchText={searchText} 
           setSearchText={setSearchText} 
           userPhoto={user?.profilePhoto} 
           onProfilePress={() => router.push('/profile')} 
           onFilterPress={() => setShowFilterModal(true)}
           onScannerPress={() => router.push('/scanner')} 
        />
        {renderTabsHeader()}
        
        {!permissionGranted && !isInitialLoading && (
            <TouchableOpacity onPress={manualPermissionRequest} style={styles.permErrorBox}>
                <Feather name="alert-triangle" size={16} color="#DC2626" />
                <Text style={styles.permErrorText}>Permission needed. Tap to enable.</Text>
            </TouchableOpacity>
        )}

        {activeTab === 'home' ? (
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
                 isFavorite={favoriteIds.includes(item.contactId)} 
                 toggleFavorite={toggleFavorite} 
               />
             )}
             renderSectionHeader={({ section: { title } }) => (
               <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text></View>
             )}
             ListHeaderComponent={!hasNoAds ? <ScrollingAdBanner /> : null}
             contentContainerStyle={{ paddingBottom: insets.bottom + 100, backgroundColor: THEME.colors.bg }} 
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
        ) : (
           <FlatList 
             data={favoritesList}
             numColumns={4}
             keyExtractor={(item, index) => item.id || index.toString()}
             renderItem={({item}) => <FavoriteItem item={item} onRowPress={handleRowPress} />}
             contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: insets.bottom + 100, backgroundColor: THEME.colors.bg, flexGrow: 1 }}
             columnWrapperStyle={{ justifyContent: 'flex-start', gap: '3%', marginBottom: 24 }}
             ListEmptyComponent={
               <View style={{alignItems: 'center', marginTop: 50}}>
                 <MaterialCommunityIcons name="heart-outline" size={48} color={THEME.colors.skeleton} />
                 <Text style={{textAlign:'center', marginTop: 10, color: THEME.colors.textSub, fontWeight: '600'}}>No favorites yet</Text>
               </View>
             }
           />
        )}

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
        
        {/* 🟢 BEAUTIFUL BOTTOM SHEET FILTER MENU */}
        <Modal transparent visible={showFilterModal} animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
            <TouchableOpacity style={styles.modalOverlayBottomSheet} activeOpacity={1} onPress={() => setShowFilterModal(false)}>
                <View style={styles.bottomSheetModal}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetTitle}>Filter & Settings</Text>
                    
                    <View style={styles.filterOptionsContainer}>
                      {filterOptions.map((item) => (
                          <TouchableOpacity 
                              key={item.type} 
                              style={[styles.sheetOptionBtn, filterType === item.type && styles.sheetOptionBtnActive]}
                              onPress={() => { setFilterType(item.type as any); setShowFilterModal(false); }}
                          >
                              <View style={[styles.sheetIconBox, { backgroundColor: filterType === item.type ? item.color : '#F8FAFC' }]}>
                                <MaterialCommunityIcons 
                                  name={item.icon as any} 
                                  size={22} 
                                  color={filterType === item.type ? '#FFF' : item.color} 
                                />
                              </View>
                              <Text style={[styles.sheetOptionText, filterType === item.type && styles.sheetOptionTextActive]}>
                                {item.type} Calls
                              </Text>
                              {filterType === item.type && <Feather name="check" size={20} color={item.color} style={{marginLeft: 'auto'}} />}
                          </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.sheetDivider} />

                    {/* App Settings Button */}
                    <TouchableOpacity 
                        style={styles.sheetOptionBtn}
                        onPress={() => { 
                          setShowFilterModal(false); 
                          router.push('/settings'); 
                        }}
                    >
                        <View style={[styles.sheetIconBox, { backgroundColor: '#F8FAFC' }]}>
                          <Feather name="settings" size={22} color={THEME.colors.textSub} />
                        </View>
                        <Text style={styles.sheetOptionText}>App Settings</Text>
                        <Feather name="chevron-right" size={20} color="#CBD5E1" style={{marginLeft: 'auto'}} />
                    </TouchableOpacity>

                    {/* 🟢 NEW: GOVERNMENT SERVICES BUTTON */}
                    <TouchableOpacity 
                        style={[styles.sheetOptionBtn, { marginTop: 5 }]}
                        onPress={() => { 
                          setShowFilterModal(false); 
                          router.push('../gov_services'); 
                        }}
                    >
                        <View style={[styles.sheetIconBox, { backgroundColor: '#EFF6FF' }]}>
                          <Feather name="shield" size={22} color="#1E3A8A" />
                        </View>
                        <Text style={styles.sheetOptionText}>Government Services</Text>
                        <Feather name="chevron-right" size={20} color="#CBD5E1" style={{marginLeft: 'auto'}} />
                    </TouchableOpacity>

                </View>
            </TouchableOpacity>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  
  headerWrapper: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, backgroundColor: THEME.colors.bg },
  newHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  
  profileBtn: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  avatarImage: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  
  searchBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', marginHorizontal: 12, height: 46, borderRadius: 23, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.colors.border },
  qcallLogoText: { fontSize: 18, fontWeight: '900', color: THEME.colors.primary, fontStyle: 'italic', marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: THEME.colors.textMain },
  
  headerActionBtn: { padding: 6, marginLeft: 2 },

  tabsContainer: { flexDirection: 'row', backgroundColor: THEME.colors.bg, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, paddingHorizontal: 16 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTabButton: { borderBottomColor: '#2563EB' },
  tabText: { fontSize: 16, fontWeight: '600', color: THEME.colors.textSub },
  activeTabText: { color: '#2563EB', fontWeight: '800' },
  
  sectionHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, backgroundColor: THEME.colors.bg },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
  
  // 🟢 Updated "Normal" Card Style
  cardItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  
  // 🟢 Updated Avatar Style to perfect circle
  normalAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  missedAvatarBg: { backgroundColor: THEME.colors.dangerBg },
  realAvatar: { width: 46, height: 46, borderRadius: 23 },
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
  
  // Made Call/Heart buttons flat to match the new normal style
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  heartBtn: { padding: 8, justifyContent: 'center', alignItems: 'center' },

  inlineAdContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  inlineAdImageWrap: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', marginRight: 14 },
  inlineAdImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  inlineAdContent: { flex: 1 },
  adLabelBoxMicro: { backgroundColor: '#F59E0B', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, marginRight: 6 },
  adLabelTextMicro: { fontSize: 9, fontWeight: '900', color: '#FFF' },
  inlineAdTitle: { fontSize: 15, fontWeight: '700', color: '#92400E', flex: 1 },
  inlineAdSub: { fontSize: 12, color: '#B45309', marginTop: 2 },
  inlineAdBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  inlineAdBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },

  favoriteItemContainer: { width: '22%', alignItems: 'center' },
  favoriteAvatarWrapper: { position: 'relative', marginBottom: 8 },
  favoriteAvatar: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, backgroundColor: '#E2E8F0', borderWidth: 2, borderColor: '#FFF' },
  favoriteImage: { width: '100%', height: '100%', borderRadius: 35 },
  favoriteAvatarText: { fontSize: 24, fontWeight: '800' },
  qBadgeContainer: { position: 'absolute', top: -2, left: -2, backgroundColor: THEME.colors.qcallGreen, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF', elevation: 5 },
  qBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  favoriteName: { fontSize: 13, fontWeight: '800', color: THEME.colors.textMain, textAlign: 'center' },
  favoriteNumber: { fontSize: 10, color: THEME.colors.textSub, textAlign: 'center', marginTop: 2, fontWeight: '500' },

  fab: { position: 'absolute', right: 20, shadowColor: THEME.colors.primary, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10, borderRadius: 30 },
  fabGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  fabContent: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3B82F6' },
  
  permErrorBox: { marginHorizontal: 20, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 12, marginBottom: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
  permErrorText: { color: '#DC2626', fontWeight: '600', fontSize: 13, marginLeft: 8 },
  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.7 },
  emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 10, fontWeight: '500' },

  modalOverlayBottomSheet: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheetModal: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20, borderRadius: 2 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: THEME.colors.primary, marginBottom: 20, paddingHorizontal: 10 },
  filterOptionsContainer: { gap: 8 },
  sheetOptionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 16, backgroundColor: '#FFF' },
  sheetOptionBtnActive: { backgroundColor: '#F8FAFC' },
  sheetIconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  sheetOptionText: { fontSize: 16, color: THEME.colors.textMain, fontWeight: '600' },
  sheetOptionTextActive: { fontWeight: '800' },
  sheetDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 15, marginHorizontal: 10 },

  adBannerWrapper: { backgroundColor: '#FFF', marginHorizontal: 20, marginTop: 20, borderRadius: 20, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
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
});