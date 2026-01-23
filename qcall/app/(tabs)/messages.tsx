import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  View, Text, FlatList, StyleSheet, PermissionsAndroid, Platform, 
  ActivityIndicator, TouchableOpacity, Modal, ScrollView, Switch,
  Vibration, LayoutAnimation, UIManager, ToastAndroid, Image, TextInput
  // ❌ REMOVED: Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import SmsAndroid from 'react-native-get-sms-android';
import { useRouter, useFocusEffect } from 'expo-router'; 

// 🟢 Services & Config
import { useAuth } from '../../hooks/useAuth'; 

// 🟢 IMPORT CUSTOM ALERT HOOK
import { useCustomAlert } from '../../context/AlertContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SmsMessage {
  _id: string; 
  address: string;
  body: string;
  date: number;
}

const PAGE_SIZE = 50; 

const THEME = {
  colors: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    primary: '#0F172A',
    textMain: '#1E293B',
    textSub: '#64748B',
    danger: '#EF4444',
    success: '#10B981',
    border: '#E2E8F0',
    searchBarBg: '#FFFFFF', // Updated to match other tabs
  }
};

// --- HEADER COMPONENT (Standardized) ---
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
                <Feather name="user" size={20} color="#FFF" />
             </View>
           )}
        </TouchableOpacity>
      </View>
      <View style={styles.searchBlock}>
        <Feather name="search" size={18} color={THEME.colors.textSub} />
        <TextInput 
          placeholder="Search messages..." 
          placeholderTextColor={THEME.colors.textSub} 
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText} 
        />
        <TouchableOpacity style={styles.filterIcon}>
            <MaterialCommunityIcons name="qrcode-scan" size={20} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function MessageScreen() {
  const router = useRouter(); 
  
  // 🟢 Use Redux Hook
  const { user } = useAuth();
  
  // 🟢 HOOK THE ALERT SYSTEM
  const { showAlert } = useCustomAlert();

  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true); 
  const [loadingMore, setLoadingMore] = useState(false); 
  const [currentCount, setCurrentCount] = useState(0); 
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [showPinned, setShowPinned] = useState(true);
  const [searchText, setSearchText] = useState(''); 

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<SmsMessage | null>(null);

  // Tab-Specific Permission Check
  useFocusEffect(
    useCallback(() => {
      const checkAndLoad = async () => {
        if (Platform.OS === 'android') {
          const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
          if (hasPermission) {
            fetchMessages(0);
          } else {
            const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
            if (status === PermissionsAndroid.RESULTS.GRANTED) {
              fetchMessages(0);
            } else {
              setLoading(false);
              // 🔴 ERROR ALERT
              showAlert("Permission Denied", "We need SMS permission to display your messages.", "error");
            }
          }
        } else {
          setLoading(false);
          // 🟠 IOS WARNING
          showAlert("Not Supported", "SMS reading is not supported on iOS.", "warning");
        }
      };

      loadPinnedMessages();
      checkAndLoad();
    }, [])
  );

  const loadPinnedMessages = async () => {
    try {
      const storedIds = await AsyncStorage.getItem('pinned_msgs');
      if (storedIds) setPinnedIds(JSON.parse(storedIds));
    } catch (e) { console.log("Error loading pins", e); }
  };

  const togglePin = async (msgId: string) => {
    const idString = String(msgId);
    Vibration.vibrate(50); 
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    let newPinned = [...pinnedIds];
    const isPinning = !newPinned.includes(idString);

    if (!isPinning) {
      newPinned = newPinned.filter(id => id !== idString); 
      ToastAndroid.show("Unpinned", ToastAndroid.SHORT);
    } else {
      newPinned.push(idString); 
      ToastAndroid.show("Pinned to Top", ToastAndroid.SHORT);
    }

    setPinnedIds(newPinned);
    await AsyncStorage.setItem('pinned_msgs', JSON.stringify(newPinned));
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
          const newBatch = JSON.parse(smsList);
          if (startIndex === 0) setMessages(newBatch);
          else setMessages(prev => [...prev, ...newBatch]);
          setCurrentCount(startIndex + PAGE_SIZE);
        } catch (e) { console.log(e); } 
        finally { setLoading(false); setLoadingMore(false); }
      }
    );
  };

  const loadMoreMessages = () => {
    if (!loadingMore && !loading && messages.length >= PAGE_SIZE) {
      fetchMessages(currentCount);
    }
  };

  const { pinnedList, regularList } = useMemo(() => {
    const pinned: SmsMessage[] = [];
    const regular: SmsMessage[] = [];
    const lowerSearch = searchText.toLowerCase();

    messages.forEach(msg => {
      const address = msg.address || '';
      const body = msg.body || '';
      const matchesSearch = address.toLowerCase().includes(lowerSearch) || body.toLowerCase().includes(lowerSearch);

      if (!matchesSearch) return;

      if (pinnedIds.includes(String(msg._id))) {
        pinned.push(msg);
      } else {
        regular.push(msg);
      }
    });

    return { pinnedList: pinned, regularList: regular };
  }, [messages, pinnedIds, searchText]); 

  const getAvatarColor = (letter: string) => {
    const colors = ['#E3F2FD', '#F3E5F5', '#E8F5E9', '#FFF3E0', '#FFEBEE', '#E0F7FA', '#FCE4EC', '#F1F8E9'];
    const index = letter.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const renderMessageItem = ({ item, isPinned }: { item: SmsMessage, isPinned?: boolean }) => {
    const itemIdString = String(item._id);
    const address = item.address || 'Unknown';
    const isNumber = !isNaN(Number(address.replace('+', ''))); 
    const isBank = address.toLowerCase().includes('bk') || address.toLowerCase().includes('bank');
    const senderLetter = isNumber ? '#' : address.charAt(0).toUpperCase();
    const avatarColor = getAvatarColor(senderLetter);

    const dateObj = new Date(item.date);
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return (
      <TouchableOpacity 
        style={[styles.itemContainer, isPinned && styles.pinnedItemContainer]} 
        onPress={() => { setSelectedMessage(item); setModalVisible(true); }}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: isNumber ? '#F1F5F9' : avatarColor }]}>
           {isBank ? (
             <MaterialCommunityIcons name="bank" size={22} color="#64748B" />
           ) : isNumber ? (
             <Ionicons name="person" size={22} color="#94A3B8" />
           ) : (
             <Text style={styles.avatarText}>{senderLetter}</Text>
           )}
        </View>

        <View style={styles.contentColumn}>
          <Text style={styles.senderName} numberOfLines={1}>{item.address}</Text>
          <Text style={styles.messagePreview} numberOfLines={1}>
            {item.body.replace(/\n/g, ' ')}
          </Text>
        </View>

        <View style={styles.metaColumn}>
           <Text style={styles.dateText}>{timeString}</Text>
           <View style={styles.actionsRow}>
             <TouchableOpacity 
                 onPress={() => togglePin(itemIdString)}
                 hitSlop={{top:10, bottom:10, left:10, right:10}}
                 style={styles.pinTapArea}
             >
                 <MaterialCommunityIcons 
                   name={isPinned ? "pin" : "pin-outline"} 
                   size={18} 
                   color={isPinned ? THEME.colors.primary : "#B0B0B0"} 
                   style={isPinned ? {transform: [{rotate: '-45deg'}]} : {}}
                 />
             </TouchableOpacity>
             <View style={styles.simBadge}>
                 <Text style={styles.simText}>1</Text>
             </View>
           </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={{ backgroundColor: THEME.colors.bg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catContainer}>
         {['All', 'Private', 'Promotion', 'Spam'].map((cat) => (
             <TouchableOpacity 
               key={cat} 
               style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
               onPress={() => setSelectedCategory(cat)}
             >
                <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
             </TouchableOpacity>
         ))}
      </ScrollView>

      {pinnedList.length > 0 && (
          <View style={styles.sectionHeaderRow}>
             <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <MaterialCommunityIcons name="pin" size={14} color={THEME.colors.primary} style={{transform: [{rotate: '-45deg'}]}} />
                <Text style={styles.sectionTitle}> Pinned</Text>
             </View>
             <Switch 
               value={showPinned} 
               onValueChange={setShowPinned}
               trackColor={{ false: "#E0E0E0", true: "#BBDEFB" }}
               thumbColor={showPinned ? THEME.colors.primary : "#f4f3f4"}
               style={{ transform: [{ scaleX: .8 }, { scaleY: .8 }] }}
             />
          </View>
      )}

      {showPinned && pinnedList.map(msg => (
         <View key={String(msg._id)}>{renderMessageItem({ item: msg, isPinned: true })}</View>
      ))}

      {pinnedList.length > 0 && showPinned && <View style={styles.divider} />}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor={THEME.colors.bg} />
      
      <HeaderComponent 
        searchText={searchText} 
        setSearchText={setSearchText} 
        onProfilePress={() => router.push('/profile')} 
        userPhoto={user?.profilePhoto}
      />

      {loading ? (
        <ActivityIndicator size="large" color={THEME.colors.primary} style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={regularList}
          keyExtractor={(item) => String(item._id)} 
          renderItem={(props) => renderMessageItem({ ...props, isPinned: false })}
          ListHeaderComponent={ListHeader}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.5} 
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <TouchableOpacity style={styles.fab}>
          <MaterialCommunityIcons name="message-plus-outline" size={20} color="#fff" />
          <Text style={styles.fabText}>New Chat</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
           <View style={styles.modalHeader}>
             <TouchableOpacity onPress={() => setModalVisible(false)}>
               <Ionicons name="arrow-back" size={24} color="#000" />
             </TouchableOpacity>
             <Text style={styles.modalTitle}>Details</Text>
             <View style={{width: 24}} /> 
           </View>

           {selectedMessage && (
             <ScrollView style={{padding: 20}}>
                <View style={styles.modalAvatarContainer}>
                   <View style={[styles.bigAvatar, { backgroundColor: '#E3F2FD' }]}>
                      <Text style={styles.bigAvatarText}>{selectedMessage.address.charAt(0)}</Text>
                   </View>
                   <Text style={styles.modalSender}>{selectedMessage.address}</Text>
                   <Text style={styles.modalDate}>{new Date(selectedMessage.date).toLocaleString()}</Text>
                </View>

                <View style={styles.messageBubble}>
                   <Text style={{fontSize: 16, lineHeight: 24, color: '#333'}}>{selectedMessage.body}</Text>
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
  
  // Standardized Header
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

  // Content Styles
  catContainer: { paddingHorizontal: 20, paddingVertical: 12 },
  catPill: { backgroundColor: '#F1F5F9', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  catPillActive: { backgroundColor: '#E0F2FE', borderColor: THEME.colors.primary },
  catText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  catTextActive: { color: THEME.colors.primary },
  
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: THEME.colors.primary, marginLeft: 6 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginHorizontal: 20, marginVertical: 5 },
  
  itemContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F8F9FA' },
  pinnedItemContainer: { backgroundColor: '#F8FAFC' },
  avatar: { width: 46, height: 46, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#444' },
  contentColumn: { flex: 1, justifyContent: 'center', marginRight: 8 },
  senderName: { fontSize: 16, fontWeight: '700', color: THEME.colors.textMain, marginBottom: 4 },
  messagePreview: { fontSize: 13, color: THEME.colors.textSub, lineHeight: 18 },
  metaColumn: { alignItems: 'flex-end', justifyContent: 'space-between', height: 42 },
  dateText: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginBottom: 4 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinTapArea: { padding: 4 },
  simBadge: { backgroundColor: '#F1F5F9', width: 16, height: 16, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  simText: { color: '#94A3B8', fontSize: 10, fontWeight: 'bold' },
  
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 30, elevation: 6, shadowColor: THEME.colors.primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3 },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginLeft: 8 },
  
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalAvatarContainer: { alignItems: 'center', marginBottom: 20 },
  bigAvatar: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  bigAvatarText: { fontSize: 28, fontWeight: 'bold', color: THEME.colors.primary },
  modalSender: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 5 },
  modalDate: { fontSize: 14, color: '#666' },
  messageBubble: { backgroundColor: '#F1F5F9', padding: 20, borderRadius: 16, marginTop: 10 },
});