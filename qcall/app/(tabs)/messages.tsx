import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  View, Text, FlatList, StyleSheet, PermissionsAndroid, Platform, 
  TouchableOpacity, ScrollView, Vibration, UIManager, 
  Image, TextInput, Animated, Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import SmsAndroid from 'react-native-get-sms-android';
import { useRouter, useFocusEffect } from 'expo-router'; 
import * as Contacts from 'expo-contacts';

import { useAuth } from '../../hooks/useAuth'; 
import { useCustomAlert } from '../../context/AlertContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// 🟢 HELPER: Normalize phone numbers for better matching
const normalizeNumber = (phone: string) => {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
};

interface SmsMessage {
  _id: string; 
  address: string;
  body: string;
  date: number;
}

interface GroupedConversation {
  conversationId: string;
  address: string;
  displayName: string;
  displayImage?: string;
  lastMessage: string;
  timestamp: number;
  category: string;
}

const THEME = {
  colors: {
    bg: '#F8FAFC', 
    primary: '#0F172A', 
    textMain: '#1E293B',
    textSub: '#64748B',
    skeleton: '#E2E8F0', 
    accent: '#6366F1'
  }
};

const SkeletonItem = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();
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

const HeaderComponent = React.memo(({ searchText, setSearchText, userPhoto, onProfilePress }: any) => {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <View style={styles.headerWrapper}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.headerDate}>{dateStr}</Text>
          <Text style={styles.headerTitle}>Messages</Text>
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
          placeholder="Search conversations..." 
          placeholderTextColor={THEME.colors.textSub} 
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText} 
        />
      </View>
    </View>
  );
});

export default function MessageScreen() {
  const router = useRouter(); 
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [conversations, setConversations] = useState<GroupedConversation[]>([]);
  const [loading, setLoading] = useState(true); 
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState(''); 
  const [contactMap, setContactMap] = useState<Map<string, { name: string, imageUri?: string }>>(new Map());

  useFocusEffect(
    useCallback(() => {
      checkPermissionsAndLoad();
    }, [])
  );

  const checkPermissionsAndLoad = async () => {
    if (Platform.OS === 'android') {
      const hasSms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      if (hasSms) {
        const loadedMap = await loadContacts(); 
        fetchAndGroupMessages(loadedMap); 
        loadPinnedConversations();
      } else {
        const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
        if (status === PermissionsAndroid.RESULTS.GRANTED) {
          const loadedMap = await loadContacts();
          fetchAndGroupMessages(loadedMap);
        } else {
          setLoading(false);
          showAlert("Permission Denied", "SMS permission is required.", "error");
        }
      }
    } else {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      const map = new Map<string, { name: string, imageUri?: string }>();
      
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.Image],
        });
        
        data.forEach(c => {
          if (c.phoneNumbers && c.name) {
             c.phoneNumbers.forEach(p => {
               const clean = normalizeNumber(p.number || '');
               if(clean) map.set(clean, { name: c.name, imageUri: c.image?.uri });
             });
          }
        });
        setContactMap(map);
      }
      return map; 
    } catch (e) { 
      return new Map(); 
    }
  };

  const loadPinnedConversations = async () => {
    try {
      const stored = await AsyncStorage.getItem('pinned_chats');
      if (stored) setPinnedIds(JSON.parse(stored));
    } catch (e) {}
  };

  const fetchAndGroupMessages = (currentContactMap: Map<string, any> = contactMap) => {
    const filter = { box: 'inbox', indexFrom: 0, maxCount: 1000 }; 
    
    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: string) => { setLoading(false); },
      (count: number, smsList: string) => {
        try {
          const rawMessages: SmsMessage[] = JSON.parse(smsList);
          const groups: { [key: string]: GroupedConversation } = {};

          rawMessages.forEach((msg) => {
            const address = msg.address;
            
            if (!groups[address]) {
              const cleanNum = normalizeNumber(address);
              const contact = currentContactMap.get(cleanNum);
              
              groups[address] = {
                conversationId: address,
                address: address,
                displayName: contact?.name || address, 
                displayImage: contact?.imageUri,
                lastMessage: msg.body,
                timestamp: msg.date,
                category: determineCategory(msg, contact),
              };
            }

            if (msg.date > groups[address].timestamp) {
              groups[address].lastMessage = msg.body;
              groups[address].timestamp = msg.date;
            }
          });

          const groupedArray = Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
          setConversations(groupedArray);
        } catch (e) { console.log(e); } 
        finally { setLoading(false); }
      }
    );
  };

  // 🟢 STRICT CATEGORY LOGIC FIX
  const determineCategory = (msg: SmsMessage, contact: any) => {
    // 1. MUST have a saved contact name to be in the 'Private' tab.
    if (contact && contact.name) return 'Private';
    
    const body = msg.body.toLowerCase();
    const sender = msg.address.toLowerCase();
    const isNumericSender = /^[0-9+]+$/.test(sender.replace('-', ''));

    // 2. Filter obvious machine senders
    if (body.includes('otp') || body.includes('code')) return 'OTP';
    if (body.includes('offer') || body.includes('sale')) return 'Promotion';
    if (!isNumericSender && (sender.includes('-') || sender.length <= 9)) return 'OTP'; 
    
    // 3. Unsaved normal numbers go to 'Other' so they ONLY show up in the 'All' tab
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
    if (selectedCategory !== 'All') {
      data = data.filter(c => c.category === selectedCategory);
    }
    const pinned = data.filter(c => pinnedIds.includes(c.conversationId));
    const unpinned = data.filter(c => !pinnedIds.includes(c.conversationId));
    return [...pinned, ...unpinned];
  }, [conversations, searchText, selectedCategory, pinnedIds]);

  const openGoogleMessages = async () => {
    const url = 'sms:';
    try { await Linking.openURL(url); } catch (err) { showAlert("Error", "No messaging app found.", "error"); }
  };

  const handleConversationPress = (item: GroupedConversation) => {
    router.push({ 
        pathname: '/messages/chat', 
        params: { 
            senderId: item.address, 
            senderName: item.displayName, 
            isBank: item.category === 'OTP' || item.category === 'Promotion' ? 'true' : 'false',
            avatar: item.displayImage || ''
        } 
    });
  };

  const renderItem = ({ item }: { item: GroupedConversation }) => {
    const isPinned = pinnedIds.includes(item.conversationId);
    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity 
        style={[styles.itemContainer, isPinned && styles.pinnedItem]}
        activeOpacity={0.7}
        onPress={() => handleConversationPress(item)}
        onLongPress={() => togglePin(item.conversationId)}
      >
        <View style={styles.avatarContainer}>
            {item.displayImage ? (
                <Image source={{ uri: item.displayImage }} style={styles.realAvatar} />
            ) : (
                <View style={[styles.placeholderAvatar, getAvatarStyle(item.category)]}>
                    {getAvatarIcon(item.category, item.displayName)}
                </View>
            )}
        </View>

        <View style={styles.contentColumn}>
            <View style={styles.headerRow}>
                <Text style={styles.nameText} numberOfLines={1}>{item.displayName}</Text>
                {isPinned && <MaterialCommunityIcons name="pin" size={14} color={THEME.colors.primary} style={{marginLeft: 6, transform: [{rotate: '-45deg'}]}} />}
            </View>
            <Text style={styles.messageText} numberOfLines={1}>
                {item.lastMessage}
            </Text>
        </View>

        <View style={styles.metaColumn}>
            <Text style={styles.timeText}>{time}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const getAvatarStyle = (cat: string) => {
    switch(cat) {
        case 'OTP': return { backgroundColor: '#EFF6FF' };
        case 'Promotion': return { backgroundColor: '#FAF5FF' };
        case 'Spam': return { backgroundColor: '#FEF2F2' };
        default: return { backgroundColor: '#F1F5F9' };
    }
  };

  const getAvatarIcon = (cat: string, name: string) => {
    switch(cat) {
        case 'OTP': return <MaterialCommunityIcons name="shield-check-outline" size={22} color="#2563EB" />;
        case 'Promotion': return <Feather name="shopping-bag" size={20} color="#9333EA" />;
        case 'Spam': return <Feather name="alert-triangle" size={20} color="#DC2626" />;
        default: return <Text style={{fontSize: 18, fontWeight: '700', color: '#475569'}}>{name.charAt(0).toUpperCase()}</Text>;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor={THEME.colors.bg} />
      <HeaderComponent searchText={searchText} setSearchText={setSearchText} onProfilePress={() => router.push('/profile')} userPhoto={user?.profilePhoto} />
      
      <View style={{backgroundColor: THEME.colors.bg, zIndex: 10}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catContainer}>
            {['All', 'Private', 'OTP', 'Promotion', 'Spam'].map((cat) => (
                <TouchableOpacity key={cat} style={[styles.catPill, selectedCategory === cat && styles.catPillActive]} onPress={() => setSelectedCategory(cat)}>
                    <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{marginTop: 10}}>{[1, 2, 3, 4, 5, 6].map(i => <SkeletonItem key={i} />)}</View>
      ) : (
        <FlatList
          data={displayedConversations}
          keyExtractor={(item) => item.conversationId}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openGoogleMessages}>
          <View style={styles.fabIcon}>
             <MaterialCommunityIcons name="pencil-outline" size={24} color="#FFF" />
          </View>
          <Text style={styles.fabText}>Compose</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.bg },
  headerWrapper: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, backgroundColor: THEME.colors.bg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerDate: { fontSize: 13, color: THEME.colors.textSub, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 34, fontWeight: '900', color: THEME.colors.primary, letterSpacing: -1 },
  profileBtn: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  avatarImage: { width: 48, height: 48, borderRadius: 18, borderWidth: 2, borderColor: '#FFF' },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 18, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  searchBlock: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, height: 52, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: THEME.colors.textMain, fontWeight: '500' },
  catContainer: { paddingHorizontal: 24, paddingVertical: 12 },
  catPill: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  catPillActive: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
  catText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  catTextActive: { color: '#FFF' },
  itemContainer: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
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
});