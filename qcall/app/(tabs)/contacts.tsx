import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image,
  SectionList, Vibration, LayoutAnimation, Platform, UIManager,
  ToastAndroid, TextInput, GestureResponderEvent, RefreshControl, NativeModules,
  Animated, Easing
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Contacts from 'expo-contacts'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout';
import { useRouter, useFocusEffect } from 'expo-router'; 
import * as IntentLauncher from 'expo-intent-launcher'; 

import { useAuth } from '../../hooks/useAuth'; 
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
    accent: '#0F766E', 
    accentBg: '#CCFBF1',
    danger: '#EF4444',
    border: '#E2E8F0',
    skeleton: '#E2E8F0',
    gold: '#F59E0B',
  }
};

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// 🟢 1. COLORFUL AVATAR GENERATOR
const getAvatarStyle = (name: string) => {
  const bgColors = [
    '#F3F4F6', '#ECFEFF', '#F0FDF4', '#FFF7ED', '#FEF2F2', '#F5F3FF', '#EFF6FF', '#FFFBEB',
    '#E0F2FE', '#FAE8FF', '#FFE4E6', '#DCFCE7' 
  ];
  const textColors = [
    '#374151', '#0E7490', '#15803D', '#C2410C', '#B91C1C', '#7C3AED', '#1D4ED8', '#B45309',
    '#0369A1', '#86198F', '#BE123C', '#15803D'
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % bgColors.length;
  return { 
    backgroundColor: bgColors[index], 
    color: textColors[index] 
  };
};

const SkeletonContact = () => {
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
    <View style={styles.row}>
      <Animated.View style={[styles.skeletonAvatar, { opacity }]} />
      <View style={styles.info}>
        <Animated.View style={[styles.skeletonText, { width: '50%', height: 16, marginBottom: 6, opacity }]} />
        <Animated.View style={[styles.skeletonText, { width: '30%', height: 12, opacity }]} />
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
          <Text style={styles.headerTitle}>Contacts</Text>
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
          placeholder="Search contacts..." 
          placeholderTextColor={THEME.colors.textSub} 
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText} 
        />
        <TouchableOpacity style={styles.filterIcon}>
            <MaterialCommunityIcons name="sort-alphabetical-variant" size={22} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function ContactsScreen() {
  const router = useRouter(); 
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); 
  const [permissionGranted, setPermissionGranted] = useState(true);
  const [search, setSearch] = useState('');
  const [myNumber, setMyNumber] = useState('+91 00000 00000'); 
  const [sidebarHeight, setSidebarHeight] = useState(0);
  
  const lastScrolledLetter = useRef<string | null>(null);
  const sectionListRef = useRef<SectionList>(null);

  useFocusEffect(
    useCallback(() => {
      const checkAndLoad = async () => {
        const { status } = await Contacts.getPermissionsAsync();
        if (status === 'granted') {
          setPermissionGranted(true);
          if (allContacts.length === 0) loadContacts();
        } else {
          const { status: newStatus } = await Contacts.requestPermissionsAsync();
          if (newStatus === 'granted') {
            setPermissionGranted(true);
            loadContacts();
          } else {
            setPermissionGranted(false);
            setLoading(false);
          }
        }
      };
      loadUserData(); 
      loadFavorites();
      checkAndLoad();
    }, []) 
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
        const sorted = data.filter(c => c.name && c.name.trim() !== '').sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setAllContacts(sorted);
      }
    } catch (e) { console.error("Error loading contacts:", e); } 
    finally { setLoading(false); }
  };

  const onRefresh = useCallback(() => { loadContacts(); }, []);

  // 🟢 2. SMART SEAMLESS "SAVE CONTACT"
  const createNewContact = async () => {
    if (Platform.OS !== 'android') {
        await Contacts.presentFormAsync(null);
        return;
    }

    try {
        // A. Try forcing Google Contacts
        await IntentLauncher.startActivityAsync('android.intent.action.INSERT', {
            data: 'content://com.android.contacts/contacts',
            packageName: 'com.google.android.contacts' 
        });
    } catch (error) {
        console.log("Google Contacts not installed, falling back...");
        try {
            // B. Fallback
            await IntentLauncher.startActivityAsync('android.intent.action.INSERT', {
                data: 'content://com.android.contacts/contacts'
            });
        } catch (e) {
            showAlert("Error", "Could not open contact editor.", "error");
        }
    }
    setTimeout(loadContacts, 3000);
  };

  const handleNativeCall = async (rawNumber: string) => {
    if (!rawNumber) return;
    const cleanNumber = rawNumber.replace(/[^\d+]/g, '');
    if (Platform.OS === 'android') {
        try {
            const isDefault = await CallManagerModule.checkIsDefaultDialer();
            if (!isDefault) {
                showAlert(
                    "Default Dialer Required",
                    "To make calls directly, please set QCall as your default phone app.",
                    "warning",
                    () => CallManagerModule.requestDefaultDialer()
                );
                return;
            }
            CallManagerModule.startCall(cleanNumber);
        } catch (e) {
            showAlert("Error", "Could not initiate call.", "error");
        }
    } else {
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
    if (search.length === 0 || 'me'.includes(lowerSearch)) result.push({ title: 'ME', data: [myProfile] });
    if (favorites.length > 0) result.push({ title: 'FAVORITES', data: favorites });
    
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
    getItemHeight: () => 76, getSeparatorHeight: () => 0, getSectionHeaderHeight: () => 40, listHeaderHeight: 180 
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
    
    // 🟢 3. APPLY COLORFUL AVATAR
    const avatarStyle = getAvatarStyle(name);

    return (
      <TouchableOpacity 
        style={styles.row} 
        activeOpacity={0.7} 
        onLongPress={() => !isMe && toggleFavorite(item.id)} 
        onPress={() => {
            if (isMe) return; 
            // @ts-ignore
            router.push({
                pathname: '/contact_details', 
                params: { contactId: item.id } 
            });
        }} 
      >
        <View style={styles.avatarContainer}>
          {item.imageAvailable && item.image?.uri ? (
             <Image source={{ uri: item.image.uri }} style={styles.realImage} />
          ) : (
             <View style={[styles.avatar, { backgroundColor: isMe ? '#EFF6FF' : avatarStyle.backgroundColor }]}>
                <Text style={[styles.avatarText, { color: isMe ? THEME.colors.accent : avatarStyle.color }]}>{letter}</Text>
             </View>
          )}
          {(isMe || isFav) && (
              <View style={styles.qBadge}>
                  {isMe ? <Text style={styles.qText}>Me</Text> : <MaterialCommunityIcons name="star" size={10} color="#B45309" />}
              </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {rawNumber ? <Text style={styles.number} numberOfLines={1}>{rawNumber}</Text> : null}
        </View>

        <View style={styles.actionCol}>
           <TouchableOpacity onPress={() => handleNativeCall(rawNumber)} style={styles.callBtn}>
             <Ionicons name="call" size={20} color="#FFF" />
           </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeader}>
       <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionCard} onPress={createNewContact}>
             <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
                 <Ionicons name="person-add" size={20} color="#16A34A" />
             </View>
             <Text style={styles.actionText}>New Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}>
             <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                 <MaterialCommunityIcons name="account-group" size={22} color="#2563EB" />
             </View>
             <Text style={styles.actionText}>Create Group</Text>
          </TouchableOpacity>
       </View>
       <View style={styles.controlBar}>
          <Text style={styles.contactCount}>ALL CONTACTS ({allContacts.length})</Text>
       </View>
    </View>
  );

  if (loading && allContacts.length === 0) {
    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <HeaderComponent searchText={search} setSearchText={setSearch} userPhoto={user?.profilePhoto} />
                <View style={{paddingHorizontal: 20}}>
                    {[1,2,3,4,5,6,7].map(i => <SkeletonContact key={i}/>)}
                </View>
            </SafeAreaView>
        </View>
    );
  }

  if (!permissionGranted) {
    return (
        <View style={styles.center}>
            <MaterialCommunityIcons name="account-lock" size={60} color={THEME.colors.textSub} />
            <Text style={{ marginTop: 20, marginBottom: 20, color: THEME.colors.textMain, fontSize: 16 }}>Access to contacts is required</Text>
            <TouchableOpacity onPress={loadContacts} style={styles.retryBtn}>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>Allow Access</Text>
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
                    <Text style={[styles.sectionTitle, title === 'FAVORITES' && {color: THEME.colors.gold}]}>{title}</Text>
                 </View>
              )}
              ListHeaderComponent={ListHeader}
              contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
              refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={THEME.colors.primary} />}
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
            
            {/* 🟢 FAB FIXED POSITION: bottom: 110 */}
            <TouchableOpacity style={styles.fab} onPress={createNewContact}>
                 <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  retryBtn: { backgroundColor: THEME.colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, elevation: 4 },
  
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

  listHeader: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 10, height: 160 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 20, width: '48%', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4 },
  iconCircle: { width: 38, height: 38, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  actionText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  controlBar: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  contactCount: { fontSize: 12, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase' },
  
  sectionHeader: { backgroundColor: THEME.colors.bg, paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
  
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#FFF', height: 76, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }, 
  avatarContainer: { marginRight: 16 },
  avatar: { width: 50, height: 50, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  realImage: { width: 50, height: 50, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  qBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  qText: { color: '#B45309', fontSize: 10, fontWeight: '800' },
  
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: THEME.colors.textMain, marginBottom: 2 },
  number: { color: THEME.colors.textSub, fontSize: 13, fontWeight: '500' },
  
  actionCol: { flexDirection: 'row', alignItems: 'center' },
  callBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: THEME.colors.primary, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  
  azSidebar: { position: 'absolute', right: 2, top: 180, bottom: 100, width: 24, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  azItem: { flex: 1, width: 30, alignItems: 'center', justifyContent: 'center' },
  azText: { fontSize: 10, fontWeight: '800', color: '#CBD5E1' },
  
  // 🟢 FAB POSITION FIXED
  fab: { position: 'absolute', bottom: 110, right: 24, backgroundColor: THEME.colors.primary, width: 60, height: 60, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: THEME.colors.primary, shadowOpacity: 0.4, shadowRadius: 12 },

  skeletonAvatar: { width: 50, height: 50, borderRadius: 20, backgroundColor: '#E2E8F0', marginRight: 16 },
  skeletonText: { backgroundColor: '#E2E8F0', borderRadius: 4 },
});