import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  View, Text, FlatList, StyleSheet, PermissionsAndroid, Platform, 
  ActivityIndicator, TouchableOpacity, Modal, ScrollView, Switch,
  Vibration, LayoutAnimation, UIManager, ToastAndroid, Image, TextInput,
  Animated, NativeModules, Linking // 🟢 Added Linking
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

const getRandomLightColor = () => {
  const lightColors = [
    '#FDF4FF', '#F0FDF4', '#FEFCE8', '#ECFEFF', '#F3F4F6', 
    '#FFF1F2', '#F5F3FF', '#FFF7ED', '#EFF6FF', '#FAFAF9'
  ];
  return lightColors[Math.floor(Math.random() * lightColors.length)];
};

interface SmsMessage {
  _id: string; 
  address: string;
  body: string;
  date: number;
}

interface ContactInfo {
  name: string;
  imageUri?: string;
}

const PAGE_SIZE = 50; 

const THEME = {
  colors: {
    bg: '#F8FAFC', 
    card: '#FFFFFF',
    primary: '#0F172A', 
    accent: '#3B82F6', 
    textMain: '#1E293B',
    textSub: '#64748B',
    danger: '#EF4444',
    success: '#10B981',
    gold: '#F59E0B', 
    border: '#E2E8F0',
    skeleton: '#E2E8F0', 
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
        <TouchableOpacity style={styles.filterIcon}>
            <MaterialCommunityIcons name="tune-vertical" size={20} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function MessageScreen() {
  const router = useRouter(); 
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true); 
  const [loadingMore, setLoadingMore] = useState(false); 
  const [currentCount, setCurrentCount] = useState(0); 
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState(''); 

  const [contactMap, setContactMap] = useState<Map<string, ContactInfo>>(new Map());
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<SmsMessage | null>(null);
  const [modalBgColor, setModalBgColor] = useState('#FFFFFF');

  useFocusEffect(
    useCallback(() => {
      const checkAndLoad = async () => {
        if (Platform.OS === 'android') {
          const hasSmsPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
          if (hasSmsPermission) {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') await loadContacts();
            fetchMessages(0);
          } else {
            const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
            if (status === PermissionsAndroid.RESULTS.GRANTED) {
              const { status: contactStatus } = await Contacts.requestPermissionsAsync();
              if (contactStatus === 'granted') await loadContacts();
              fetchMessages(0);
            } else {
              setLoading(false);
              showAlert("Permission Denied", "SMS permission is required.", "error");
            }
          }
        } else {
          setLoading(false);
          showAlert("Not Supported", "iOS does not support raw SMS reading.", "warning");
        }
      };
      loadPinnedMessages();
      checkAndLoad();
    }, [])
  );

  // 🟢 REDIRECTION LOGIC: Opens Google Messages
  const openGoogleMessages = async () => {
    const url = 'sms:';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert("Error", "No messaging app found on this device.", "error");
      }
    } catch (err) {
      console.error("Linking error:", err);
    }
  };

  const loadContacts = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.Image],
      });
      const map = new Map<string, ContactInfo>();
      
      if (data.length > 0) {
        data.forEach(contact => {
          if (contact.phoneNumbers) {
            contact.phoneNumbers.forEach(phone => {
              if (phone.number) {
                const cleanNumber = phone.number.replace(/\D/g, '').slice(-10); 
                map.set(cleanNumber, {
                    name: contact.name,
                    imageUri: contact.imageAvailable ? contact.image?.uri : undefined
                });
              }
            });
          }
        });
      }
      setContactMap(map);
    } catch (e) { console.log("Contacts Error", e); }
  };

  const loadPinnedMessages = async () => {
    try {
      const storedIds = await AsyncStorage.getItem('pinned_msgs');
      if (storedIds) setPinnedIds(JSON.parse(storedIds));
    } catch (e) { console.log("Error pins", e); }
  };

  const getCategory = (msg: SmsMessage, cleanNumber: string): string => {
    if (contactMap.has(cleanNumber)) return 'Private';
    const body = msg.body.toLowerCase();
    const sender = msg.address.toLowerCase();
    const isNumericSender = /^[0-9+]+$/.test(sender.replace('-', ''));
    if (body.includes('otp') || body.includes('code') || body.includes('password')) return 'OTP';
    if (body.includes('offer') || body.includes('sale') || body.includes('win') || body.includes('congrats')) return 'Spam';
    if (!isNumericSender && (sender.includes('-') || sender.length <= 9)) return 'Promotion';
    if (isNumericSender && sender.length >= 10) return 'Private'; 
    return 'All';
  };

  const fetchMessages = (startIndex: number) => {
    if (startIndex > 0 && loadingMore) return;
    if (startIndex > 0) setLoadingMore(true);
    const filter = { box: 'inbox', indexFrom: startIndex, maxCount: PAGE_SIZE };
    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: string) => { setLoading(false); setLoadingMore(false); },
      (count: number, smsList: string) => {
        try {
          const rawBatch = JSON.parse(smsList);
          if (startIndex === 0) setMessages(rawBatch);
          else setMessages(prev => [...prev, ...rawBatch]);
          setCurrentCount(startIndex + PAGE_SIZE);
        } catch (e) { console.log(e); } 
        finally { setLoading(false); setLoadingMore(false); }
      }
    );
  };

  const loadMoreMessages = () => {
    if (!loadingMore && !loading && messages.length >= PAGE_SIZE) fetchMessages(currentCount);
  };

  const togglePin = async (msgId: string) => {
    const idString = String(msgId);
    Vibration.vibrate(50); 
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    let newPinned = [...pinnedIds];
    if (newPinned.includes(idString)) {
      newPinned = newPinned.filter(id => id !== idString);
      ToastAndroid.show("Unpinned", ToastAndroid.SHORT);
    } else {
      newPinned.push(idString);
      ToastAndroid.show("Pinned", ToastAndroid.SHORT);
    }
    setPinnedIds(newPinned);
    await AsyncStorage.setItem('pinned_msgs', JSON.stringify(newPinned));
  };

  const { pinnedList, regularList } = useMemo(() => {
    const pinned: any[] = [];
    const regular: any[] = [];
    const lowerSearch = searchText.toLowerCase();
    messages.forEach(msg => {
      const cleanAddr = msg.address.replace(/\D/g, '').slice(-10);
      const contactInfo = contactMap.get(cleanAddr);
      const displayName = contactInfo?.name ?? msg.address;
      const displayImage = contactInfo?.imageUri;
      const category = getCategory(msg, cleanAddr);
      const matchesSearch = displayName.toLowerCase().includes(lowerSearch) || msg.body.toLowerCase().includes(lowerSearch);
      if (!matchesSearch) return;
      if (selectedCategory !== 'All' && category !== selectedCategory) return;
      const processedMsg = { ...msg, displayName, displayImage, category, cleanAddr };
      if (pinnedIds.includes(String(msg._id))) pinned.push(processedMsg);
      else regular.push(processedMsg);
    });
    return { pinnedList: pinned, regularList: regular };
  }, [messages, pinnedIds, searchText, selectedCategory, contactMap]); 

  const renderAvatar = (name: string, category: string, imageUri?: string) => {
    if (imageUri) return <Image source={{ uri: imageUri }} style={[styles.avatar, styles.realImage]} />;
    if (category === 'Private' && !/^[0-9+]+$/.test(name)) {
        return (
            <View style={[styles.avatar, { backgroundColor: '#CCFBF1', borderWidth: 1, borderColor: '#2DD4BF' }]}>
                <Text style={[styles.avatarText, { color: '#0F766E' }]}>{name.charAt(0).toUpperCase()}</Text>
                <View style={styles.savedBadge} />
            </View>
        );
    }
    if (category === 'OTP') return <View style={[styles.avatar, { backgroundColor: '#EFF6FF' }]}><MaterialCommunityIcons name="shield-check-outline" size={22} color="#2563EB" /></View>;
    if (category === 'Promotion') return <View style={[styles.avatar, { backgroundColor: '#FAF5FF' }]}><Feather name="shopping-bag" size={20} color="#9333EA" /></View>;
    if (category === 'Spam') return <View style={[styles.avatar, { backgroundColor: '#FEF2F2' }]}><Feather name="alert-triangle" size={20} color="#DC2626" /></View>;
    const bgColors = ['#F3F4F6', '#F0FDF4', '#FFF7ED', '#FDF4FF'];
    const textColors = ['#4B5563', '#16A34A', '#EA580C', '#C026D3'];
    const idx = name.length % bgColors.length;
    return <View style={[styles.avatar, { backgroundColor: bgColors[idx] }]}><Text style={[styles.avatarText, { color: textColors[idx] }]}>{name.charAt(0).toUpperCase()}</Text></View>;
  };

  const renderMessageItem = ({ item }: { item: any }) => {
    const dateObj = new Date(item.date);
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isPinned = pinnedIds.includes(String(item._id));
    return (
      <TouchableOpacity 
        style={[styles.itemContainer, isPinned && styles.pinnedItemContainer]} 
        onPress={() => { 
            const newColor = getRandomLightColor();
            setModalBgColor(newColor);
            setSelectedMessage(item); 
            setModalVisible(true); 
        }}
        activeOpacity={0.6}
      >
        {renderAvatar(item.displayName, item.category, item.displayImage)}
        <View style={styles.contentColumn}>
          <View style={styles.nameRow}>
             <Text style={styles.senderName} numberOfLines={1}>{item.displayName}</Text>
             {isPinned && <MaterialCommunityIcons name="pin" size={14} color={THEME.colors.primary} style={{marginLeft: 6, transform: [{rotate: '-45deg'}]}} />}
          </View>
          <Text style={styles.messagePreview} numberOfLines={2}>{item.body}</Text>
        </View>
        <View style={styles.metaColumn}>
           <Text style={styles.dateText}>{timeString}</Text>
           <TouchableOpacity onPress={() => togglePin(item._id)} style={{padding: 4}}>
              <Feather name="more-horizontal" size={18} color="#CBD5E1" />
           </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
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
          data={[...pinnedList, ...regularList]}
          keyExtractor={(item) => String(item._id)} 
          renderItem={renderMessageItem}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.5} 
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* 🚀 FAB: UPDATED TO REDIRECT TO GOOGLE MESSAGES */}
      <TouchableOpacity style={styles.fab} onPress={openGoogleMessages}>
          <View style={styles.fabIcon}>
             <MaterialCommunityIcons name="pencil-outline" size={24} color="#FFF" />
          </View>
          <Text style={styles.fabText}>Compose</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: modalBgColor }]}>
           <View style={[styles.modalHeader, { borderBottomColor: 'rgba(0,0,0,0.05)' }]}>
             <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.backBtn}><Ionicons name="chevron-back" size={24} color={THEME.colors.primary} /></TouchableOpacity>
             <Text style={styles.modalTitle} numberOfLines={1}>{selectedMessage ? (selectedMessage as any).displayName : 'Message'}</Text>
             <View style={{width: 40}} /> 
           </View>
           {selectedMessage && (
             <ScrollView style={{padding: 24}}>
                <View style={styles.messageBubble}>
                   <Text style={styles.messageBody}>{selectedMessage.body}</Text>
                   <Text style={styles.messageTime}>{new Date(selectedMessage.date).toLocaleString()}</Text>
                </View>
             </ScrollView>
           )}
        </SafeAreaView>
      </Modal>
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
  filterIcon: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12 },
  catContainer: { paddingHorizontal: 24, paddingVertical: 12 },
  catPill: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  catPillActive: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
  catText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  catTextActive: { color: '#FFF' },
  itemContainer: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  pinnedItemContainer: { backgroundColor: '#F8FAFC' },
  avatar: { width: 52, height: 52, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  realImage: { borderWidth: 1, borderColor: '#E2E8F0' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  savedBadge: { width: 12, height: 12, backgroundColor: '#10B981', position: 'absolute', bottom: -2, right: -2, borderRadius: 6, borderWidth: 2, borderColor: '#FFF' },
  contentColumn: { flex: 1, justifyContent: 'center', marginRight: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  senderName: { fontSize: 16, fontWeight: '700', color: THEME.colors.textMain },
  messagePreview: { fontSize: 14, color: THEME.colors.textSub, lineHeight: 20, fontWeight: '400' },
  metaColumn: { alignItems: 'flex-end', justifyContent: 'space-between', height: 44 },
  dateText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  fab: { position: 'absolute', bottom: 110, right: 24, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 32, elevation: 8 },
  fabIcon: { marginRight: 8 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: THEME.colors.primary, flex: 1, textAlign: 'center' },
  messageBubble: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 24, borderRadius: 24, borderTopLeftRadius: 4 },
  messageBody: { fontSize: 17, lineHeight: 26, color: '#334155', fontWeight: '400' },
  messageTime: { marginTop: 16, fontSize: 12, color: '#64748B', fontWeight: '600', textAlign: 'right' },
});