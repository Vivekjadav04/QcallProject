import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image,
  SectionList, Vibration, LayoutAnimation, Platform, UIManager,
  ToastAndroid, TextInput, GestureResponderEvent, RefreshControl, NativeModules
  // ❌ REMOVED: Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Contacts from 'expo-contacts'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout';
import { useRouter, useFocusEffect } from 'expo-router'; 

// 🟢 Services & Config
import { useAuth } from '../../hooks/useAuth'; // Standardized Hook

// 🟢 IMPORT CUSTOM ALERT HOOK
import { useCustomAlert } from '../../context/AlertContext';

const { CallManagerModule } = NativeModules;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
    headerBg: '#F8FAFC' // Matches Call Log bg
  }
};

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// --- HEADER COMPONENT (Standardized) ---
const HeaderComponent = React.memo(({ searchText, setSearchText, userPhoto, onProfilePress }: any) => {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={styles.headerWrapper}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.headerDate}>{dateStr}</Text>
          <Text style={styles.headerTitle}>Contacts</Text>
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
          placeholder="Search contacts..." 
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

export default function ContactsScreen() {
  const router = useRouter(); 
  const insets = useSafeAreaInsets();
  
  // 🟢 Use Redux Hook
  const { user } = useAuth();
  
  // 🟢 HOOK THE ALERT SYSTEM
  const { showAlert } = useCustomAlert();

  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false); 
  const [permissionGranted, setPermissionGranted] = useState(true);
  const [search, setSearch] = useState('');
  const [myNumber, setMyNumber] = useState('+91 00000 00000'); 
  const [sidebarHeight, setSidebarHeight] = useState(0);
  const lastScrolledLetter = useRef<string | null>(null);
  const sectionListRef = useRef<SectionList>(null);

  // Optimized Permission & Data Fetching
  useFocusEffect(
    useCallback(() => {
      const checkAndLoad = async () => {
        const { status } = await Contacts.getPermissionsAsync();
        
        if (status === 'granted') {
          setPermissionGranted(true);
          if (allContacts.length === 0) {
            loadContacts();
          }
        } else {
          const { status: newStatus } = await Contacts.requestPermissionsAsync();
          if (newStatus === 'granted') {
            setPermissionGranted(true);
            loadContacts();
          } else {
            setPermissionGranted(false);
          }
        }
      };

      loadUserData(); 
      loadFavorites();
      checkAndLoad();
    }, [allContacts.length])
  );

  const loadUserData = async () => {
    try {
      const storedPhone = await AsyncStorage.getItem('user_phone');
      if (storedPhone) setMyNumber('+91 ' + storedPhone);
    } catch (e) { console.log(e); }
  };

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem('fav_contacts');
      if (stored) setFavoriteIds(JSON.parse(stored));
    } catch (e) { console.log(e); }
  };

  const toggleFavorite = async (id: string) => {
    Vibration.vibrate(50);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    let newFavIds = [...favoriteIds];
    if (newFavIds.includes(id)) {
      newFavIds = newFavIds.filter(favId => favId !== id);
      ToastAndroid.show("Removed from Favorites", ToastAndroid.SHORT);
    } else {
      newFavIds.push(id);
      ToastAndroid.show("Added to Favorites", ToastAndroid.SHORT);
    }
    setFavoriteIds(newFavIds);
    await AsyncStorage.setItem('fav_contacts', JSON.stringify(newFavIds));
  };

  const loadContacts = async () => {
    if (loading) return; 

    try {
      setLoading(true);
      const { data } = await Contacts.getContactsAsync({ 
          fields: [
              Contacts.Fields.PhoneNumbers, 
              Contacts.Fields.Image,
              Contacts.Fields.FirstName,
              Contacts.Fields.LastName
          ] 
      });
      
      if (data) {
        const sorted = data
          .filter(c => c.name && c.name.trim() !== '')
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setAllContacts(sorted);
      }
    } catch (e) { 
        console.error("Error loading contacts:", e); 
    } finally { 
        setLoading(false); 
    }
  };

  const onRefresh = useCallback(() => {
    loadContacts();
  }, []);

  const createNewContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        await Contacts.presentFormAsync(null);
        setTimeout(loadContacts, 2000);
      } else {
        // 🔴 ERROR ALERT
        showAlert("Permission Denied", "We cannot access contacts to add a new one.", "error");
      }
    } catch (e) { console.log(e); }
  };

  // 🟢 NATIVE CALL FUNCTION
  const handleNativeCall = async (rawNumber: string) => {
    if (!rawNumber) return;
    const cleanNumber = rawNumber.replace(/[^\d+]/g, '');

    if (Platform.OS === 'android') {
        try {
            // Check if we are default dialer
            const isDefault = await CallManagerModule.checkIsDefaultDialer();
            if (!isDefault) {
                // 🟠 WARNING ALERT
                showAlert(
                    "Default Dialer Required",
                    "To make calls directly, please set QCall as your default phone app.",
                    "warning",
                    () => CallManagerModule.requestDefaultDialer()
                );
                return;
            }
            // Trigger Native Call
            CallManagerModule.startCall(cleanNumber);
        } catch (e) {
            // 🔴 ERROR ALERT
            showAlert("Error", "Could not initiate call.", "error");
        }
    } else {
        // 🟠 WARNING ALERT
        showAlert("Not Supported", "iOS calling is currently not supported.", "warning");
    }
  };

  const sections = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = allContacts.filter(c => 
        c.name?.toLowerCase().includes(lowerSearch) || 
        c.phoneNumbers?.some((p:any) => p.number?.includes(search))
    );
    
    const favorites = filtered.filter(c => favoriteIds.includes(c.id || ''));
    const myProfile = { id: 'me_profile', name: 'Me (You)', phoneNumbers: [{ number: myNumber }], imageAvailable: false };
    
    const result = [];
    if (search.length === 0 || 'me'.includes(lowerSearch)) {
        result.push({ title: 'ME', data: [myProfile] });
    }
    if (favorites.length > 0) {
        result.push({ title: 'FAVORITES', data: favorites });
    }
    
    if (filtered.length > 0) {
      const groups: { [key: string]: any[] } = {};
      filtered.forEach(c => {
        const letter = c.name ? c.name[0].toUpperCase() : '#';
        const key = /[A-Z]/.test(letter) ? letter : '#';
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      });
      Object.keys(groups).sort().forEach(key => result.push({ title: key, data: groups[key] }));
    }
    return result;
  }, [allContacts, favoriteIds, search, myNumber]);

  const getItemLayout = useMemo(() => sectionListGetItemLayout({ 
    getItemHeight: () => 70, 
    getSeparatorHeight: () => 0, 
    getSectionHeaderHeight: () => 36, 
    listHeaderHeight: 180 
  }), [sections.length]);

  const scrollToLetter = (letter: string) => {
    if (lastScrolledLetter.current === letter) return;
    lastScrolledLetter.current = letter;
    const sectionIndex = sections.findIndex(s => s.title === letter);
    if (sectionIndex !== -1 && sectionListRef.current) {
        Vibration.vibrate(5);
        sectionListRef.current.scrollToLocation({ sectionIndex, itemIndex: 0, animated: false, viewOffset: 0 });
    }
  };

  const handleSidebarTouch = (e: GestureResponderEvent) => {
    const { locationY } = e.nativeEvent;
    if (sidebarHeight <= 0) return;
    const itemHeight = sidebarHeight / ALPHABET.length;
    let index = Math.floor(locationY / itemHeight);
    index = Math.max(0, Math.min(index, ALPHABET.length - 1));
    scrollToLetter(ALPHABET[index]);
  };

  const renderContactItem = ({ item }: { item: any }) => {
    const isMe = item.id === 'me_profile';
    const isFav = favoriteIds.includes(item.id);
    const name = item.name || 'Unknown';
    const rawNumber = item.phoneNumbers?.[0]?.number || '';
    const letter = name.charAt(0).toUpperCase();

    return (
      <TouchableOpacity 
        style={styles.row} 
        activeOpacity={0.7} 
        onLongPress={() => !isMe && toggleFavorite(item.id)} 
        onPress={() => handleNativeCall(rawNumber)} 
      >
        <View style={styles.avatarContainer}>
          {item.imageAvailable && item.image?.uri ? (
             <Image source={{ uri: item.image.uri }} style={styles.realImage} />
          ) : (
             <View style={[styles.avatar, { backgroundColor: '#E3F2FD' }]}>
                <Text style={styles.avatarText}>{letter}</Text>
             </View>
          )}
          {(isMe || isFav) && <View style={styles.qBadge}><Text style={styles.qText}>{isMe ? 'Me' : '★'}</Text></View>}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {rawNumber ? <Text style={styles.number} numberOfLines={1}>{rawNumber}</Text> : null}
        </View>
        <View style={styles.actionCol}>
           {isFav && <Ionicons name="heart" size={16} color="#D32F2F" style={{marginRight: 10}} />}
           <TouchableOpacity onPress={() => handleNativeCall(rawNumber)}>
             <Ionicons name="call" size={22} color={THEME.colors.primary} />
           </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeader}>
       <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionCard} onPress={createNewContact}>
             <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}><Ionicons name="person-add" size={20} color="#2E7D32" /></View>
             <Text style={styles.actionText}>New Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}>
             <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}><MaterialCommunityIcons name="account-group" size={22} color={THEME.colors.primary} /></View>
             <Text style={styles.actionText}>New Group</Text>
          </TouchableOpacity>
       </View>
       <View style={styles.controlBar}>
          <Text style={styles.contactCount}>ALL CONTACTS ({allContacts.length})</Text>
          <View style={{flex: 1}} />
          <Ionicons name="filter" size={18} color="#666" />
       </View>
    </View>
  );

  if (!permissionGranted) {
    return (
        <View style={styles.center}>
            <Text style={{ marginBottom: 20, color: THEME.colors.textMain }}>Contact Permission Required</Text>
            <TouchableOpacity onPress={loadContacts} style={styles.retryBtn}>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>Grant Permission</Text>
            </TouchableOpacity>
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        <HeaderComponent 
           searchText={search} 
           setSearchText={setSearch} 
           onProfilePress={() => router.push('/profile')}
           userPhoto={user?.profilePhoto} 
        />
        
        <View style={{flex: 1}}>
            <SectionList
              ref={sectionListRef} 
              sections={sections} 
              keyExtractor={(item, index) => item.id + index}
              renderItem={renderContactItem} 
              getItemLayout={getItemLayout as any}
              initialNumToRender={15}
              maxToRenderPerBatch={10} 
              windowSize={5}           
              renderSectionHeader={({ section: { title } }) => (
                 <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, title === 'FAVORITES' && {color: '#D32F2F'}, title === 'ME' && {color: THEME.colors.primary}]}>{title}</Text>
                 </View>
              )}
              ListHeaderComponent={ListHeader}
              ListEmptyComponent={() => (
                 loading ? <ActivityIndicator size="small" color={THEME.colors.primary} style={{marginTop: 20}} /> : <View style={styles.center}><Text style={{color: THEME.colors.textSub}}>No contacts found</Text></View>
              )}
              contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
              refreshControl={
                <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={THEME.colors.primary} />
              }
            />
            
            {search.length === 0 && allContacts.length > 0 && (
              <View 
                 style={styles.azSidebar} 
                 onLayout={(e) => setSidebarHeight(e.nativeEvent.layout.height)} 
                 onStartShouldSetResponder={() => true} 
                 onResponderMove={handleSidebarTouch}
              >
                {ALPHABET.map(char => <View key={char} style={styles.azItem}><Text style={styles.azText}>{char}</Text></View>)}
              </View>
            )}
            
            <TouchableOpacity style={styles.fab} onPress={createNewContact}>
                 <MaterialCommunityIcons name="content-save-plus-outline" size={24} color="#FFF" />
            </TouchableOpacity>
      </View>
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  retryBtn: { backgroundColor: THEME.colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  
  // Standardized Header Styles
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

  // List Styles
  listHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, height: 180 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 16, width: '48%', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#333' },
  controlBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 10 },
  contactCount: { fontSize: 12, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 0.5 },
  
  sectionHeader: { backgroundColor: THEME.colors.bg, paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', height: 36 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#9CA3AF', letterSpacing: 0.5 },
  
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#FFF', height: 72, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }, 
  avatarContainer: { marginRight: 16 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  realImage: { width: 46, height: 46, borderRadius: 23 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#555' },
  qBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  qText: { color: '#000', fontSize: 9, fontWeight: 'bold' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: THEME.colors.textMain, marginBottom: 3 },
  number: { color: THEME.colors.textSub, fontSize: 13 },
  actionCol: { flexDirection: 'row', alignItems: 'center' },
  
  azSidebar: { position: 'absolute', right: 0, top: 180, bottom: 100, width: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', zIndex: 50 },
  azItem: { flex: 1, width: 30, alignItems: 'center', justifyContent: 'center' },
  azText: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF' },
  
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: THEME.colors.primary, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: THEME.colors.primary, shadowOpacity: 0.4, shadowRadius: 8 },
});