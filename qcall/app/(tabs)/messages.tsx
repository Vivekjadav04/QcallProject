import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, PermissionsAndroid, Platform, TouchableOpacity, ScrollView, Vibration, UIManager, Image, TextInput, Animated, NativeModules, DeviceEventEmitter, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router'; 
import * as Contacts from 'expo-contacts';
import { useAuth } from '../../hooks/useAuth'; 

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { DefaultSmsModule } = NativeModules;

const normalizeNumber = (phone: string) => {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  return clean.length >= 10 ? clean.slice(-10) : clean;
};

interface GroupedConversation {
  conversationId: string; address: string; displayName: string; displayImage?: string; lastMessage: string; timestamp: number; category: string;
}

const THEME = { colors: { bg: '#F8FAFC', primary: '#0F172A', textMain: '#1E293B', textSub: '#64748B', skeleton: '#E2E8F0', accent: '#6366F1', border: '#E2E8F0' } };

// 🚀 PROGRESS BAR COMPONENT
const SyncProgressBar = ({ progress }: { progress: number }) => {
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTextRow}>
        <Text style={styles.progressText}>Optimizing Inbox...</Text>
        <Text style={styles.progressPercent}>{progress}%</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
};

const SkeletonItem = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
    ])).start();
  }, []);
  return (
    <View style={styles.itemContainer}>
      <Animated.View style={[styles.avatar, { backgroundColor: THEME.colors.skeleton, opacity }]} />
      <View style={styles.contentColumn}>
        <Animated.View style={{ width: '60%', height: 16, backgroundColor: THEME.colors.skeleton, marginBottom: 8, borderRadius: 4, opacity }} />
        <Animated.View style={{ width: '90%', height: 12, backgroundColor: THEME.colors.skeleton, borderRadius: 4, opacity }} />
      </View>
    </View>
  );
};

// 🟢 NEW: UNIFIED HEADER COMPONENT
const HeaderComponent = React.memo(({ searchText, setSearchText, userPhoto, onProfilePress }: any) => {
  return (
    <View style={styles.headerWrapper}>
      <View style={styles.newHeaderRow}>
        
        {/* 1. Profile Icon (Left) */}
        <TouchableOpacity style={styles.profileBtn} onPress={onProfilePress} activeOpacity={0.8}>
           {userPhoto ? (
             <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
           ) : (
             <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={20} color="#FFF" />
             </View>
           )}
        </TouchableOpacity>

        {/* 2. Center Search Bar (Qcall text + input + search icon) */}
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

        {/* 3. Scanner Icon */}
        <TouchableOpacity style={styles.headerActionBtn} onPress={() => { console.log("Scanner Will Open Here") }}>
           <MaterialCommunityIcons name="qrcode-scan" size={24} color={THEME.colors.textMain} />
        </TouchableOpacity>

        {/* 4. Three Dots (Filter/Menu) */}
        <TouchableOpacity style={styles.headerActionBtn} onPress={() => {}}>
           <MaterialCommunityIcons name="dots-vertical" size={26} color={THEME.colors.textMain} />
        </TouchableOpacity>

      </View>
    </View>
  );
});

export default function MessageScreen() {
  const router = useRouter(); 
  const { user } = useAuth();
  
  const [conversations, setConversations] = useState<GroupedConversation[]>([]);
  const [loading, setLoading] = useState(true); 
  const [refreshing, setRefreshing] = useState(false); 
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState(''); 
  const [contactMap, setContactMap] = useState<Map<string, { name: string, imageUri?: string }>>(new Map());
  const [visibleCount, setVisibleCount] = useState(15);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useFocusEffect(useCallback(() => { checkPermissionsAndLoad(); }, []));

  useEffect(() => {
    if (Platform.OS === 'android') {
      DefaultSmsModule.startObservingSms();
    }

    const syncProgressListener = DeviceEventEmitter.addListener('onSyncProgress', (data) => {
      setIsSyncing(true);
      const percent = Math.round((data.synced / data.total) * 100);
      setSyncProgress(percent);
      if (percent % 10 === 0) fetchInboxNatively(contactMap); 
    });

    const syncListener = DeviceEventEmitter.addListener('onSyncComplete', async () => {
      setIsSyncing(false);
      setSyncProgress(100);
      fetchInboxNatively(await loadContacts());
    });

    const smsListener = DeviceEventEmitter.addListener('onSMSReceived', async () => fetchInboxNatively(await loadContacts()));

    return () => { 
      syncListener.remove(); 
      smsListener.remove(); 
      syncProgressListener.remove(); 
      if (Platform.OS === 'android') DefaultSmsModule.stopObservingSms();
    };
  }, [contactMap]);

  const checkPermissionsAndLoad = async () => {
    if (Platform.OS === 'android') {
      const hasSms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      if (hasSms) {
        DefaultSmsModule.syncMessages(); 
        const loadedMap = await loadContacts(); 
        fetchInboxNatively(loadedMap); 
        loadPinnedConversations();
      } else {
        const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
        if (status === PermissionsAndroid.RESULTS.GRANTED) {
          DefaultSmsModule.syncMessages();
          fetchInboxNatively(await loadContacts());
        } else setLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await DefaultSmsModule.syncMessages();
    await fetchInboxNatively(await loadContacts());
    setRefreshing(false);
  };

  const loadContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      const map = new Map<string, { name: string, imageUri?: string }>();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.Image] });
        data.forEach(c => c.phoneNumbers?.forEach(p => {
            const clean = normalizeNumber(p.number || '');
            if(clean) map.set(clean, { name: c.name, imageUri: c.image?.uri });
        }));
        setContactMap(map);
      }
      return map; 
    } catch (e) { return new Map(); }
  };

  const loadPinnedConversations = async () => {
    try {
      const stored = await AsyncStorage.getItem('pinned_chats');
      if (stored) setPinnedIds(JSON.parse(stored));
    } catch (e) {}
  };

  const fetchInboxNatively = async (currentContactMap: Map<string, any>) => {
    try {
      const rawThreads = await DefaultSmsModule.getInboxThreads(2000);
      const formatted = rawThreads.map((msg: any) => {
        const cleanNum = msg.conversationId; 
        const contact = currentContactMap.get(cleanNum);
        return {
          conversationId: cleanNum, address: msg.address, displayName: contact?.name || msg.address, displayImage: contact?.imageUri,
          lastMessage: msg.body, timestamp: msg.date, category: determineCategory(msg.body, msg.address, contact),
        };
      });
      formatted.sort((a: any, b: any) => b.timestamp - a.timestamp);
      setConversations(formatted);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const determineCategory = (body: string, address: string, contact: any) => {
    if (contact && contact.name) return 'Private';
    const b = body.toLowerCase();
    const isNumericSender = /^[0-9+]+$/.test(address.replace('-', ''));
    if (b.includes('otp') || b.includes('code')) return 'OTP';
    if (b.includes('offer') || b.includes('sale')) return 'Promotion';
    if (!isNumericSender && (address.includes('-') || address.length <= 9)) return 'OTP'; 
    return 'Other'; 
  };

  const togglePin = async (id: string) => {
    Vibration.vibrate(50);
    let newPinned = pinnedIds.includes(id) ? pinnedIds.filter(p => p !== id) : [...pinnedIds, id];
    setPinnedIds(newPinned);
    await AsyncStorage.setItem('pinned_chats', JSON.stringify(newPinned));
  };

  const displayedConversations = useMemo(() => {
    let data = conversations;
    if (searchText) {
      const lower = searchText.toLowerCase();
      data = data.filter(c => c.displayName.toLowerCase().includes(lower) || c.lastMessage.toLowerCase().includes(lower));
    }
    if (selectedCategory !== 'All') data = data.filter(c => c.category === selectedCategory);
    const pinned = data.filter(c => pinnedIds.includes(c.conversationId));
    const unpinned = data.filter(c => !pinnedIds.includes(c.conversationId));
    return [...pinned, ...unpinned];
  }, [conversations, searchText, selectedCategory, pinnedIds]);

  const handleLoadMore = () => {
    if (visibleCount < displayedConversations.length && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => { setVisibleCount((prev) => prev + 15); setIsLoadingMore(false); }, 300);
    }
  };

  const handleConversationPress = (item: GroupedConversation) => {
    router.push({ 
        pathname: '/messages/chat', 
        params: { senderId: item.conversationId, senderName: item.displayName, isBank: item.category === 'OTP' || item.category === 'Promotion' ? 'true' : 'false', avatar: item.displayImage || '' } 
    });
  };

  const renderItem = ({ item }: { item: GroupedConversation }) => {
    const isPinned = pinnedIds.includes(item.conversationId);
    const msgDate = new Date(item.timestamp);
    const isToday = msgDate.toDateString() === new Date().toDateString();
    const time = isToday ? msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

    return (
      <TouchableOpacity style={[styles.itemContainer, isPinned && styles.pinnedItem]} activeOpacity={0.7} onPress={() => handleConversationPress(item)} onLongPress={() => togglePin(item.conversationId)}>
        <View style={styles.avatarContainer}>
            {item.displayImage ? <Image source={{ uri: item.displayImage }} style={styles.realAvatar} /> : <View style={[styles.placeholderAvatar, getAvatarStyle(item.category)]}>{getAvatarIcon(item.category, item.displayName)}</View>}
        </View>
        <View style={styles.contentColumn}>
            <View style={styles.headerRow}>
                <Text style={styles.nameText} numberOfLines={1}>{item.displayName}</Text>
                {isPinned && <MaterialCommunityIcons name="pin" size={14} color={THEME.colors.primary} style={{marginLeft: 6, transform: [{rotate: '-45deg'}]}} />}
            </View>
            <Text style={styles.messageText} numberOfLines={1}>{item.lastMessage}</Text>
        </View>
        <View style={styles.metaColumn}><Text style={styles.timeText}>{time}</Text></View>
      </TouchableOpacity>
    );
  };

  const getAvatarStyle = (cat: string) => {
    switch(cat) {
        case 'OTP': return { backgroundColor: '#EFF6FF' }; case 'Promotion': return { backgroundColor: '#FAF5FF' }; case 'Spam': return { backgroundColor: '#FEF2F2' }; default: return { backgroundColor: '#F1F5F9' };
    }
  };

  const getAvatarIcon = (cat: string, name: string) => {
    switch(cat) {
        case 'OTP': return <MaterialCommunityIcons name="shield-check-outline" size={22} color="#2563EB" />; case 'Promotion': return <Feather name="shopping-bag" size={20} color="#9333EA" />; case 'Spam': return <Feather name="alert-triangle" size={20} color="#DC2626" />; default: return <Text style={{fontSize: 18, fontWeight: '700', color: '#475569'}}>{name.charAt(0).toUpperCase()}</Text>;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor={THEME.colors.bg} />
      <HeaderComponent searchText={searchText} setSearchText={setSearchText} onProfilePress={() => router.push('/profile')} userPhoto={user?.profilePhoto} />
      
      {isSyncing && <SyncProgressBar progress={syncProgress} />}

      <View style={{backgroundColor: THEME.colors.bg, zIndex: 10}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catContainer}>
            {['All', 'Private', 'OTP', 'Promotion', 'Spam'].map((cat) => (
                <TouchableOpacity key={cat} style={[styles.catPill, selectedCategory === cat && styles.catPillActive]} onPress={() => setSelectedCategory(cat)}>
                    <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
      </View>
      {loading ? ( <View style={{marginTop: 10}}>{[1, 2, 3, 4, 5, 6].map(i => <SkeletonItem key={i} />)}</View> ) : (
        <FlatList data={displayedConversations.slice(0, visibleCount)} keyExtractor={(item) => item.conversationId} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }} onEndReached={handleLoadMore} onEndReachedThreshold={0.5} ListFooterComponent={isLoadingMore ? <SkeletonItem /> : null} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.colors.primary} />} />
      )}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/messages/compose')}>
          <View style={styles.fabIcon}><MaterialCommunityIcons name="pencil-outline" size={24} color="#FFF" /></View>
          <Text style={styles.fabText}>Compose</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.bg },
  
  // 🟢 NEW HEADER STYLES
  headerWrapper: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, backgroundColor: THEME.colors.bg },
  newHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  profileBtn: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  avatarImage: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  searchBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', marginHorizontal: 12, height: 46, borderRadius: 23, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.colors.border },
  qcallLogoText: { fontSize: 18, fontWeight: '900', color: THEME.colors.primary, fontStyle: 'italic', marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: THEME.colors.textMain },
  headerActionBtn: { padding: 6, marginLeft: 2 },

  catContainer: { paddingHorizontal: 16, paddingVertical: 12 }, 
  catPill: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' }, 
  catPillActive: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary }, 
  catText: { fontSize: 14, fontWeight: '600', color: '#64748B' }, 
  catTextActive: { color: '#FFF' }, 
  itemContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }, 
  pinnedItem: { backgroundColor: '#F8FAFC' }, 
  avatarContainer: { marginRight: 15 }, 
  placeholderAvatar: { width: 52, height: 52, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }, 
  realAvatar: { width: 52, height: 52, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }, 
  contentColumn: { flex: 1, justifyContent: 'center', marginRight: 12 }, 
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 }, 
  nameText: { fontSize: 16, fontWeight: '700', color: THEME.colors.textMain }, 
  messageText: { fontSize: 14, color: THEME.colors.textSub, lineHeight: 20 }, 
  metaColumn: { alignItems: 'flex-end', justifyContent: 'center', height: 44 }, 
  timeText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' }, 
  fab: { position: 'absolute', bottom: 110, right: 24, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 32, elevation: 8 }, 
  fabIcon: { marginRight: 8 }, 
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 }, 
  avatar: { width: 52, height: 52, borderRadius: 20, marginRight: 15 },
  
  progressContainer: { paddingHorizontal: 24, paddingBottom: 10, backgroundColor: THEME.colors.bg },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, fontWeight: '600', color: THEME.colors.primary },
  progressPercent: { fontSize: 12, fontWeight: '700', color: THEME.colors.accent },
  progressBarBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: THEME.colors.accent, borderRadius: 3 }
});