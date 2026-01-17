import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image,
  SectionList, Vibration, LayoutAnimation, Platform, UIManager,
  ToastAndroid, TextInput, Alert, GestureResponderEvent, RefreshControl, NativeModules
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Contacts from 'expo-contacts'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout';
import { useRouter, useFocusEffect } from 'expo-router'; 
import { useUser } from '../../context/UserContext'; 

// 🟢 IMPORT NATIVE MODULE
const { CallManagerModule } = NativeModules;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLORS = {
  primary: '#0056D2', background: '#fff', headerBg: '#fff', searchBarBg: '#F3F4F6',
  textMain: '#1F1F1F', textSub: '#757575', divider: '#E5E7EB', fabBg: '#E3F2FD',
};

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Header Component
const HeaderComponent = ({ searchText, setSearchText, router, userPhoto }: any) => (
  <View style={styles.headerContainer}>
    <View style={styles.searchBar}>
      <TouchableOpacity style={styles.profileIconLeft} onPress={() => router.push('/(tabs)/profile')}>
         {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
         ) : (
            <View style={styles.avatarImage}>
                <Ionicons name="person" size={18} color="#FFF" />
            </View>
         )}
      </TouchableOpacity>
      <TextInput 
        placeholder="Search contacts" placeholderTextColor="#9CA3AF" 
        style={styles.searchInput} value={searchText} onChangeText={setSearchText}
        clearButtonMode="while-editing"
      />
      <View style={styles.searchRightIcons}>
         <TouchableOpacity style={styles.iconButton}>
           <MaterialCommunityIcons name="qrcode-scan" size={22} color="#6B7280" />
         </TouchableOpacity>
      </View>
    </View>
  </View>
);

export default function ContactsScreen() {
  const router = useRouter(); 
  const { user } = useUser();
  const userPhoto = user?.profilePhoto || null;

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
        Alert.alert("Permission Denied", "Cannot access contacts.");
      }
    } catch (e) { console.log(e); }
  };

  // 🟢 NATIVE CALL FUNCTION
  const handleNativeCall = async (rawNumber: string) => {
    if (!rawNumber) return;
    const cleanNumber = rawNumber.replace(/[^\d+]/g, ''); // Keep only digits and +

    if (Platform.OS === 'android') {
        try {
            // Check if we are default dialer
            const isDefault = await CallManagerModule.checkIsDefaultDialer();
            if (!isDefault) {
                Alert.alert(
                    "Default Dialer Required",
                    "To make calls directly, please set QCall as your default phone app.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Set Default", onPress: () => CallManagerModule.requestDefaultDialer() }
                    ]
                );
                return;
            }
            // Trigger Native Call (Launches CallActivity.kt)
            CallManagerModule.startCall(cleanNumber);
        } catch (e) {
            Alert.alert("Error", "Could not start call.");
        }
    } else {
        // iOS Fallback (just in case)
        Alert.alert("Not Supported", "iOS calling not implemented yet.");
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
        onPress={() => handleNativeCall(rawNumber)} // 🟢 CALL NATIVE MODULE
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
           
           {/* Call Icon explicitly triggers native call too */}
           <TouchableOpacity onPress={() => handleNativeCall(rawNumber)}>
             <Ionicons name="call" size={22} color="#0056D2" />
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
             <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}><MaterialCommunityIcons name="account-group" size={22} color="#0056D2" /></View>
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
            <Text style={{ marginBottom: 20 }}>Contact Permission Required</Text>
            <TouchableOpacity onPress={loadContacts} style={styles.retryBtn}>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>Grant Permission</Text>
            </TouchableOpacity>
        </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <HeaderComponent searchText={search} setSearchText={setSearch} router={router} userPhoto={userPhoto} />
      
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
                   <Text style={[styles.sectionTitle, title === 'FAVORITES' && {color: '#D32F2F'}, title === 'ME' && {color: '#0056D2'}]}>{title}</Text>
                </View>
             )}
             ListHeaderComponent={ListHeader}
             ListEmptyComponent={() => (
                loading ? <ActivityIndicator size="small" color="#0056D2" style={{marginTop: 20}} /> : <View style={styles.center}><Text>No contacts found</Text></View>
             )}
             contentContainerStyle={{ paddingBottom: 100 }}
             refreshControl={
               <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#0056D2" />
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
                <MaterialCommunityIcons name="content-save-plus-outline" size={24} color="#0056D2" />
           </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  retryBtn: { backgroundColor: '#0056D2', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  headerContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.searchBarBg, borderRadius: 30, paddingHorizontal: 10, height: 50 },
  profileIconLeft: { marginRight: 10 },
  avatarImage: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center' },
  searchInput: { flex: 1, fontSize: 16, color: '#000' },
  searchRightIcons: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  iconButton: { padding: 5 },
  listHeader: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, height: 180 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', padding: 10, borderRadius: 12, width: '48%', borderWidth: 1, borderColor: '#E5E7EB' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#333' },
  controlBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10 },
  contactCount: { fontSize: 12, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 0.5 },
  sectionHeader: { backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', height: 36 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#9CA3AF', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#fff', height: 70 }, 
  avatarContainer: { marginRight: 15 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  realImage: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#555' },
  qBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  qText: { color: '#000', fontSize: 9, fontWeight: 'bold' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 3 },
  number: { color: '#6B7280', fontSize: 13 },
  actionCol: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  azSidebar: { position: 'absolute', right: 0, top: 180, bottom: 100, width: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 50 },
  azItem: { flex: 1, width: 30, alignItems: 'center', justifyContent: 'center' },
  azText: { fontSize: 9, fontWeight: 'bold', color: '#6B7280' },
  fab: { position: 'absolute', bottom: 25, right: 25, backgroundColor: COLORS.fabBg, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});