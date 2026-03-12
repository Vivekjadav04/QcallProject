import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image,
  SectionList, Vibration, LayoutAnimation, Platform, UIManager,
  ToastAndroid, TextInput, GestureResponderEvent, RefreshControl, NativeModules,
  Animated, FlatList, Linking, Modal, Dimensions, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Contacts from 'expo-contacts'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout';
import { useRouter, useFocusEffect } from 'expo-router'; 
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { useAuth } from '../../hooks/useAuth'; 
import { useCustomAlert } from '../../context/AlertContext';
import { useContactFilter } from '../../hooks/useContactFilter';
import ContactSettingsSheet from '../../components/ContactSettingsSheet';

const { CallManagerModule } = NativeModules;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    danger: '#EF4444',
    border: '#E2E8F0',
    skeleton: '#E2E8F0',
    gold: '#F59E0B',
    qcallGreen: '#22C55E' 
  }
};

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const getAvatarStyle = (name: string) => {
  const bgColors = ['#F3F4F6', '#ECFEFF', '#F0FDF4', '#FFF7ED', '#FEF2F2', '#F5F3FF', '#EFF6FF', '#FFFBEB', '#E0F2FE', '#FAE8FF', '#FFE4E6', '#DCFCE7'];
  const textColors = ['#374151', '#0E7490', '#15803D', '#C2410C', '#B91C1C', '#7C3AED', '#1D4ED8', '#B45309', '#0369A1', '#86198F', '#BE123C', '#15803D'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % bgColors.length;
  return { backgroundColor: bgColors[index], color: textColors[index] };
};

const SkeletonContact = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
    ])).start();
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

const FavoriteItem = React.memo(({ item, onRowPress }: any) => {
  const displayName = item.name || item.number || '?';
  const avatarStyle = getAvatarStyle(displayName);
  const hasImage = item.imageAvailable && item.image?.uri;

  return (
    <TouchableOpacity style={styles.favoriteItemContainer} activeOpacity={0.7} onPress={() => onRowPress(item)}>
      <View style={styles.favoriteAvatarWrapper}>
        <View style={[styles.favoriteAvatar, !hasImage && { backgroundColor: avatarStyle.backgroundColor }]}>
           {hasImage ? (
              <Image source={{ uri: item.image.uri }} style={styles.favoriteImage} />
           ) : (
              <Text style={[styles.favoriteAvatarText, { color: avatarStyle.color }]}>{displayName[0].toUpperCase()}</Text>
           )}
        </View>
        <View style={styles.qBadgeContainer}><Text style={styles.qBadgeText}>Q</Text></View>
      </View>
      <Text style={styles.favoriteName} numberOfLines={1}>{displayName}</Text>
    </TouchableOpacity>
  );
});

const HeaderComponent = React.memo(({ searchText, setSearchText, userPhoto, onProfilePress, onMenuPress, onScannerPress }: any) => {
  return (
    <View style={styles.headerWrapper}>
      <View style={styles.newHeaderRow}>
        <TouchableOpacity style={styles.profileBtn} onPress={onProfilePress} activeOpacity={0.8}>
           {userPhoto ? <Image source={{ uri: userPhoto }} style={styles.avatarImage} /> : <View style={styles.avatarPlaceholder}><Feather name="user" size={20} color="#FFF" /></View>}
        </TouchableOpacity>
        <View style={styles.searchBlock}>
          <Text style={styles.qcallLogoText}>Qcall</Text>
          <TextInput placeholder="" style={styles.searchInput} value={searchText} onChangeText={setSearchText} />
          <Feather name="search" size={20} color={THEME.colors.textMain} />
        </View>
        <TouchableOpacity style={styles.headerActionBtn} onPress={onScannerPress}>
           <MaterialCommunityIcons name="qrcode-scan" size={24} color={THEME.colors.textMain} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerActionBtn} onPress={onMenuPress}>
           <MaterialCommunityIcons name="dots-vertical" size={26} color={THEME.colors.textMain} />
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

  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  
  // 🟢 Destructuring visibleContactIds instead of hiddenContactIds
  const { accounts = [], visibleContactIds = [], toggleAccountVisibility, toggleAllAccounts, loadAccounts: refreshAccounts } = useContactFilter() || {};

  const [activeTab, setActiveTab] = useState<'home' | 'favorite'>('home');
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); 
  const [permissionGranted, setPermissionGranted] = useState(true);
  const [search, setSearch] = useState('');
  const [myNumber, setMyNumber] = useState('+91 00000 00000'); 
  const [sidebarHeight, setSidebarHeight] = useState(0);
  
  const lastScrolledLetter = useRef<string | null>(null);
  const sectionListRef = useRef<SectionList>(null);

  useEffect(() => {
    if (showMainMenu) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 40 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start();
    }
  }, [showMainMenu]);

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
      if(refreshAccounts) refreshAccounts(); 
    }, [allContacts.length]) 
  );

  const loadUserData = async () => {
    try {
      const storedPhone = await AsyncStorage.getItem('user_phone');
      if (storedPhone) setMyNumber('+91 ' + storedPhone);
    } catch (e) {}
  };

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem('@qcall_favorites');
      if (stored) setFavoriteIds(JSON.parse(stored));
    } catch (e) {}
  };

  const toggleFavorite = async (id: string) => {
    Vibration.vibrate(50);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    let newFavIds = [...favoriteIds];
    if (newFavIds.includes(id)) {
      newFavIds = newFavIds.filter(favId => favId !== id);
      if(Platform.OS === 'android') ToastAndroid.show("Removed from Favorites", ToastAndroid.SHORT);
    } else {
      newFavIds.push(id);
      if(Platform.OS === 'android') ToastAndroid.show("Added to Favorites", ToastAndroid.SHORT);
    }
    setFavoriteIds(newFavIds);
    await AsyncStorage.setItem('@qcall_favorites', JSON.stringify(newFavIds));
  };

  const loadContacts = async () => {
    try {
      setLoading(true);
      const { data } = await Contacts.getContactsAsync({ 
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image, Contacts.Fields.FirstName, Contacts.Fields.LastName] 
      });
      if (data) setAllContacts(data);
    } catch (e) { console.error("Error loading contacts:", e); } 
    finally { setLoading(false); }
  };

  const onRefresh = useCallback(() => { 
    loadFavorites(); 
    loadContacts(); 
    if(refreshAccounts) refreshAccounts();
  }, []);

  const createNewContact = () => router.push('/save_contact');

  const handleNativeCall = async (rawNumber: string) => {
    if (!rawNumber) return;
    const cleanNumber = rawNumber.replace(/[^\d+]/g, '');
    if (Platform.OS === 'android') {
        try {
            if (!CallManagerModule?.checkIsDefaultDialer) {
                Linking.openURL(`tel:${cleanNumber}`);
                return;
            }
            const isDefault = await CallManagerModule.checkIsDefaultDialer();
            if (!isDefault) {
                showAlert("Default Dialer Required", "To make calls directly, please set QCall as your default phone app.", "warning", () => CallManagerModule?.requestDefaultDialer?.());
                return;
            }
            CallManagerModule?.startCall?.(cleanNumber);
        } catch (e) { showAlert("Error", "Could not initiate call.", "error"); }
    } else { Linking.openURL(`tel:${cleanNumber}`); }
  };

  const generateVCFData = async () => {
    const { data } = await Contacts.getContactsAsync();
    if (data.length === 0) return null;

    let vcfString = '';
    data.forEach(contact => {
      vcfString += 'BEGIN:VCARD\nVERSION:3.0\n';
      vcfString += `FN:${contact.name || 'Unknown'}\n`;
      if (contact.phoneNumbers) {
        contact.phoneNumbers.forEach((phone: any) => {
          vcfString += `TEL;TYPE=${phone.label || 'CELL'}:${phone.number}\n`;
        });
      }
      vcfString += 'END:VCARD\n';
    });
    return vcfString;
  };

  const exportToFolderVCF = async () => {
    setShowExportModal(false);
    try {
      setIsProcessing(true);
      const vcfString = await generateVCFData();
      if (!vcfString) {
        showAlert('No Contacts', 'You have no contacts to export.', 'warning');
        setIsProcessing(false);
        return;
      }

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            'Qcall_Contacts.vcf',
            'text/x-vcard'
          );
          await FileSystem.writeAsStringAsync(fileUri, vcfString, { encoding: 'utf8' });
          showAlert('Success', 'Contacts successfully saved to your selected folder.', 'success');
        }
      }
    } catch (error) {
      showAlert('Error', 'Failed to save the file to your device.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportAndShare = async () => {
    setShowExportModal(false);
    try {
      setIsProcessing(true);
      const vcfString = await generateVCFData();
      if (!vcfString) {
        setIsProcessing(false);
        return;
      }

      const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const fileUri = `${dir}Qcall_Contacts.vcf`;
      
      await FileSystem.writeAsStringAsync(fileUri, vcfString, { encoding: 'utf8' });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/vcard', dialogTitle: 'Share Qcall Contacts' });
      }
    } catch (error) {
      showAlert('Error', 'Failed to generate the backup file.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const importFromFolderVCF = async () => {
    setShowMainMenu(false); 
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/vcard', 'text/x-vcard', '*/*'], 
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return; 

      setLoading(true);
      const fileUri = result.assets[0].uri;
      const vcfData = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' });
      
      const contactBlocks = vcfData.split('END:VCARD');
      const totalContacts = contactBlocks.length - 1; 

      if (totalContacts > 0) {
        showAlert('Success', `Found ${totalContacts} contacts. Ready to import.`, 'success');
      } else {
        showAlert('Empty File', 'Could not find any valid contacts in this file.', 'warning');
      }
    } catch (error) {
      showAlert('Error', 'Failed to read the contact file.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const performBatchDelete = () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
      "Delete Contacts", 
      `Are you sure you want to permanently delete ${selectedIds.length} contact(s)?`, 
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", style: "destructive", 
          onPress: async () => {
            try {
              if (!CallManagerModule?.deleteContactNative) {
                 showAlert("Error", "Native delete method not found.", "error");
                 return;
              }
              setLoading(true);
              for (const id of selectedIds) {
                await CallManagerModule.deleteContactNative(id);
              }
              setSelectedIds([]);
              setIsSelectionMode(false);
              onRefresh();
            } catch (e) {
              showAlert("Error", "Failed to delete some contacts.", "error");
            } finally { setLoading(false); }
          }
        }
      ]
    );
  };

  const toggleContactSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selId => selId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const visibleContacts = useMemo(() => {
    if (visibleContactIds.includes('HIDE_ALL')) return [];

    const stringVisibleIds = new Set((visibleContactIds || []).map(String));

    const allowed = allContacts.filter(c => stringVisibleIds.has(String(c.id || '')));
    
    const map = new Map();
    allowed.forEach(c => {
       const name = c.name?.trim() || 'Unknown';
       if (!map.has(name)) {
          map.set(name, { ...c, phoneNumbers: [...(c.phoneNumbers || [])] });
       } else {
          const existing = map.get(name);
          const newNumbers = c.phoneNumbers || [];
          
          newNumbers.forEach((nn: any) => {
             const cleanNew = nn.number?.replace(/\D/g, '') || '';
             const isDuplicate = existing.phoneNumbers.some((em: any) => (em.number?.replace(/\D/g, '') || '') === cleanNew);
             if (!isDuplicate && nn.number) {
                 existing.phoneNumbers.push(nn);
             }
          });
          if (!existing.imageAvailable && c.imageAvailable) {
              existing.imageAvailable = true;
              existing.image = c.image;
          }
       }
    });

    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allContacts, visibleContactIds]);

  const sections = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = visibleContacts.filter(c => 
        c.name?.toLowerCase().includes(lowerSearch) || 
        c.phoneNumbers?.some((p:any) => p.number?.includes(search))
    );
    const myProfile = { id: 'me_profile', name: 'Me (You)', phoneNumbers: [{ number: myNumber }], imageAvailable: false };
    
    const result = [];
    if (search.length === 0 || 'me'.includes(lowerSearch)) result.push({ title: 'ME', data: [myProfile] });
    
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
  }, [visibleContacts, search, myNumber]);

  const favoritesData = useMemo(() => {
    return visibleContacts.filter(c => favoriteIds.includes(c.id || ''));
  }, [visibleContacts, favoriteIds]);

  const getItemLayout = useMemo(() => sectionListGetItemLayout({ 
    getItemHeight: () => 76, getSeparatorHeight: () => 0, getSectionHeaderHeight: () => 44, listHeaderHeight: 160 
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
    const isSelected = selectedIds.includes(item.id);
    const name = item.name || 'Unknown';
    
    const numberCount = item.phoneNumbers?.length || 0;
    const displayedNumbers = item.phoneNumbers?.slice(0, 2).map((p:any) => p.number).join(', ') || '';
    const extraCountText = numberCount > 2 ? ` (+${numberCount - 2})` : '';

    const letter = name.charAt(0).toUpperCase();
    const avatarStyle = getAvatarStyle(name);

    return (
      <TouchableOpacity 
        style={[styles.row, isSelected && styles.rowSelected]} 
        activeOpacity={0.7} 
        onLongPress={() => {
            if (isMe) return;
            if (!isSelectionMode) {
              Vibration.vibrate(50);
              setIsSelectionMode(true);
              toggleContactSelection(item.id);
            }
        }} 
        onPress={() => {
            if (isMe) return; 
            if (isSelectionMode) {
              toggleContactSelection(item.id);
            } else {
              // @ts-ignore
              router.push({ pathname: '/contact_details', params: { contactId: item.id } });
            }
        }} 
      >
        {isSelectionMode && !isMe && (
          <View style={styles.checkboxContainer}>
            <Ionicons 
              name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={isSelected ? THEME.colors.primary : "#CBD5E1"} 
            />
          </View>
        )}

        <View style={styles.avatarContainer}>
          {item.imageAvailable && item.image?.uri ? (
             <Image source={{ uri: item.image.uri }} style={styles.realImage} />
          ) : (
             <View style={[styles.avatar, { backgroundColor: isMe ? '#EFF6FF' : avatarStyle.backgroundColor }]}>
                <Text style={[styles.avatarText, { color: isMe ? THEME.colors.accent : avatarStyle.color }]}>{letter}</Text>
             </View>
          )}
          {isMe && <View style={styles.qBadge}><Text style={styles.qText}>Me</Text></View>}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {displayedNumbers ? <Text style={styles.number} numberOfLines={1}>{displayedNumbers}{extraCountText}</Text> : null}
        </View>

        {!isSelectionMode && (
          <View style={styles.actionCol}>
            {!isMe && (
                <TouchableOpacity style={styles.heartBtn} onPress={() => toggleFavorite(item.id)}>
                  <MaterialCommunityIcons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? THEME.colors.danger : "#CBD5E1"} />
                </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleNativeCall(item.phoneNumbers?.[0]?.number)} style={styles.callBtn}>
              <Ionicons name="call" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeader}>
       <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionCard} onPress={createNewContact}>
             <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}><Ionicons name="person-add" size={20} color="#16A34A" /></View>
             <Text style={styles.actionText}>New Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}>
             <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}><MaterialCommunityIcons name="account-group" size={22} color="#2563EB" /></View>
             <Text style={styles.actionText}>Create Group</Text>
          </TouchableOpacity>
       </View>
       <View style={styles.controlBar}>
          <Text style={styles.contactCount}>ALL CONTACTS ({visibleContacts.length - 1})</Text>
       </View>
    </View>
  );

  const renderTabsHeader = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity style={[styles.tabButton, activeTab === 'home' && styles.activeTabButton]} onPress={() => setActiveTab('home')}>
        <MaterialCommunityIcons name="account-multiple" size={22} color={activeTab === 'home' ? '#2563EB' : THEME.colors.textSub} style={{marginRight: 6}} />
        <Text style={[styles.tabText, activeTab === 'home' && styles.activeTabText]}>All Contacts</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.tabButton, activeTab === 'favorite' && styles.activeTabButton]} onPress={() => setActiveTab('favorite')}>
        <MaterialCommunityIcons name={activeTab === 'favorite' ? "heart" : "heart-outline"} size={22} color={activeTab === 'favorite' ? '#2563EB' : THEME.colors.textSub} style={{marginRight: 6}} />
        <Text style={[styles.tabText, activeTab === 'favorite' && styles.activeTabText]}>Favorites</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && allContacts.length === 0) {
    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <HeaderComponent searchText={search} setSearchText={setSearch} userPhoto={user?.profilePhoto} onScannerPress={() => router.push('/scanner')} onMenuPress={() => setShowMainMenu(true)} />
                {renderTabsHeader()}
                <View style={{paddingHorizontal: 20}}>{[1,2,3,4,5,6,7].map(i => <SkeletonContact key={i}/>)}</View>
            </SafeAreaView>
        </View>
    );
  }

  if (!permissionGranted) {
    return (
        <View style={styles.center}>
            <MaterialCommunityIcons name="account-lock" size={60} color={THEME.colors.textSub} />
            <Text style={{ marginTop: 20, marginBottom: 20, color: THEME.colors.textMain, fontSize: 16 }}>Access to contacts is required</Text>
            <TouchableOpacity onPress={loadContacts} style={styles.retryBtn}><Text style={{color: '#fff', fontWeight: 'bold'}}>Allow Access</Text></TouchableOpacity>
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        
        {isSelectionMode ? (
          <View style={styles.selectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={styles.closeSelectionBtn} onPress={() => { setIsSelectionMode(false); setSelectedIds([]); }}>
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.selectionHeaderText}>{selectedIds.length} Selected</Text>
            </View>
            <TouchableOpacity style={[styles.deleteBatchBtn, selectedIds.length === 0 && { opacity: 0.5 }]} onPress={performBatchDelete} disabled={selectedIds.length === 0}>
              <Feather name="trash-2" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <HeaderComponent 
             searchText={search} setSearchText={setSearch} onProfilePress={() => router.push('/profile')}
             userPhoto={user?.profilePhoto} onScannerPress={() => router.push('/scanner')} onMenuPress={() => setShowMainMenu(true)} 
          />
        )}
        
        {!isSelectionMode && renderTabsHeader()}
        
        <View style={{flex: 1}}>
            {activeTab === 'home' ? (
              <SectionList
                ref={sectionListRef} sections={sections} keyExtractor={(item, index) => item.id + index} renderItem={renderContactItem} getItemLayout={getItemLayout as any}
                initialNumToRender={15} maxToRenderPerBatch={10} windowSize={5}          
                renderSectionHeader={({ section: { title } }) => (<View style={styles.sectionHeader}><Text style={[styles.sectionTitle, title === 'FAVORITES' && {color: THEME.colors.gold}]}>{title}</Text></View>)}
                ListHeaderComponent={!isSelectionMode ? ListHeader : null} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
                refreshControl={!isSelectionMode ? <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={THEME.colors.primary} /> : undefined}
              />
            ) : (
              <FlatList 
                data={favoritesData} numColumns={4} keyExtractor={(item, index) => item.id || index.toString()}
                renderItem={({item}) => <FavoriteItem item={item} onRowPress={(itm: any) => router.push({pathname: '/contact_details', params: { contactId: itm.id }})} />}
                contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: insets.bottom + 120, backgroundColor: THEME.colors.bg, flexGrow: 1 }}
                columnWrapperStyle={{ justifyContent: 'flex-start', gap: '3%', marginBottom: 24 }}
                ListEmptyComponent={<View style={{alignItems: 'center', marginTop: 50}}><MaterialCommunityIcons name="heart-outline" size={48} color={THEME.colors.skeleton} /><Text style={{textAlign:'center', marginTop: 10, color: THEME.colors.textSub, fontWeight: '600'}}>No favorites yet</Text></View>}
              />
            )}
            
            {activeTab === 'home' && search.length === 0 && visibleContacts.length > 0 && !isSelectionMode && (
              <View style={styles.azSidebar} onLayout={(e) => setSidebarHeight(e.nativeEvent.layout.height)} onStartShouldSetResponder={() => true} onResponderMove={handleSidebarTouch}>
                {ALPHABET.map(char => <View key={char} style={styles.azItem}><Text style={styles.azText}>{char}</Text></View>)}
              </View>
            )}
            
            {!isSelectionMode && (
              <TouchableOpacity style={styles.fab} onPress={createNewContact}>
                   <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
              </TouchableOpacity>
            )}
        </View>

        {/* 🟢 SIDE MENU MODAL */}
        <Modal transparent visible={showMainMenu} animationType="none" onRequestClose={() => setShowMainMenu(false)}>
            <TouchableOpacity style={styles.modalOverlaySide} activeOpacity={1} onPress={() => setShowMainMenu(false)}>
                <View style={{flex: 1}} /> 
                <Animated.View style={[styles.rightMenuContainer, { transform: [{ translateX: slideAnim }] }]} onStartShouldSetResponder={() => true}>
                    
                    <View style={styles.sideMenuHeader}>
                        <Text style={styles.sideMenuTitle}>Menu</Text>
                        <TouchableOpacity onPress={() => setShowMainMenu(false)} style={styles.closeSideMenu}>
                            <Feather name="x" size={24} color={THEME.colors.textMain} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.sideMenuContent}>
                      <TouchableOpacity style={styles.sideMenuItem} onPress={() => { setShowMainMenu(false); setTimeout(() => setShowAccountSettings(true), 200); }}>
                          <View style={[styles.sideMenuIconBox, { backgroundColor: '#EFF6FF' }]}><MaterialCommunityIcons name="filter-variant" size={22} color="#3B82F6" /></View>
                          <Text style={styles.sideMenuText}>Filter Contacts</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.sideMenuItem} onPress={importFromFolderVCF}>
                          <View style={[styles.sideMenuIconBox, { backgroundColor: '#F0FDF4' }]}><MaterialCommunityIcons name="import" size={22} color="#10B981" /></View>
                          <Text style={styles.sideMenuText}>Import Contacts</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.sideMenuItem} onPress={() => { setShowMainMenu(false); setTimeout(() => setShowExportModal(true), 200); }}>
                          <View style={[styles.sideMenuIconBox, { backgroundColor: '#FEF2F2' }]}><MaterialCommunityIcons name="export" size={22} color="#EF4444" /></View>
                          <Text style={styles.sideMenuText}>Export Contacts</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.sideMenuItem} onPress={() => { setShowMainMenu(false); setIsSelectionMode(true); }}>
                          <View style={[styles.sideMenuIconBox, { backgroundColor: '#FEF2F2' }]}><Feather name="trash-2" size={22} color={THEME.colors.danger} /></View>
                          <Text style={[styles.sideMenuText, { color: THEME.colors.danger }]}>Delete Contacts</Text>
                      </TouchableOpacity>

                      {/* 🟢 NEW: GOVERNMENT SERVICES BUTTON */}
                      <TouchableOpacity style={styles.sideMenuItem} onPress={() => { setShowMainMenu(false); router.push('../gov_services'); }}>
                          <View style={[styles.sideMenuIconBox, { backgroundColor: '#EFF6FF' }]}><Feather name="shield" size={22} color="#1E3A8A" /></View>
                          <Text style={styles.sideMenuText}>Government Services</Text>
                      </TouchableOpacity>

                      {/* App Settings */}
                      <TouchableOpacity style={styles.sideMenuItem} onPress={() => { setShowMainMenu(false); router.push('/settings'); }}>
                          <View style={[styles.sideMenuIconBox, { backgroundColor: '#F8FAFC' }]}><Feather name="settings" size={22} color={THEME.colors.textSub} /></View>
                          <Text style={styles.sideMenuText}>App Settings</Text>
                      </TouchableOpacity>
                    </View>
                </Animated.View>
            </TouchableOpacity>
        </Modal>

        <Modal transparent={true} visible={showExportModal} animationType="fade" onRequestClose={() => setShowExportModal(false)}>
          <View style={styles.exportModalOverlay}>
            <View style={styles.exportModalContent}>
              <View style={styles.exportIconHeader}>
                <MaterialCommunityIcons name="contacts" size={40} color="#4C1D95" />
              </View>
              <Text style={styles.exportModalTitle}>Export Contacts</Text>
              <Text style={styles.exportModalDesc}>Save a backup to your device folders or share it directly.</Text>

              <TouchableOpacity style={styles.exportPrimaryBtn} onPress={exportToFolderVCF} disabled={isProcessing}>
                {isProcessing ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Feather name="download" size={20} color="#FFF" />
                    <Text style={styles.exportPrimaryText}>Download to Device</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.exportSecondaryBtn} onPress={exportAndShare} disabled={isProcessing}>
                {isProcessing ? <ActivityIndicator color="#4C1D95" /> : (
                  <>
                    <Feather name="share" size={20} color="#4C1D95" />
                    <Text style={styles.exportSecondaryText}>Quick Share</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.exportCancelBtn} onPress={() => setShowExportModal(false)}>
                <Text style={styles.exportCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <ContactSettingsSheet 
           visible={showAccountSettings} onClose={() => setShowAccountSettings(false)} accounts={accounts} 
           onToggleAccount={toggleAccountVisibility} onToggleAll={toggleAllAccounts}
        />

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  retryBtn: { backgroundColor: THEME.colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, elevation: 4 },
  
  headerWrapper: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, backgroundColor: THEME.colors.bg },
  newHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  profileBtn: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  avatarImage: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  searchBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', marginHorizontal: 12, height: 46, borderRadius: 23, paddingHorizontal: 16, borderWidth: 1, borderColor: THEME.colors.border },
  qcallLogoText: { fontSize: 18, fontWeight: '900', color: THEME.colors.primary, fontStyle: 'italic', marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: THEME.colors.textMain },
  headerActionBtn: { padding: 6, marginLeft: 2 },
  
  selectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: THEME.colors.primary, paddingHorizontal: 20, paddingVertical: 15, elevation: 5 },
  closeSelectionBtn: { padding: 5, marginRight: 15 },
  selectionHeaderText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  deleteBatchBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },

  tabsContainer: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border, paddingHorizontal: 16 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTabButton: { borderBottomColor: '#2563EB' },
  tabText: { fontSize: 16, fontWeight: '600', color: THEME.colors.textSub },
  activeTabText: { color: '#2563EB', fontWeight: '800' },
  favoriteItemContainer: { width: '22%', alignItems: 'center' },
  favoriteAvatarWrapper: { position: 'relative', marginBottom: 8 },
  favoriteAvatar: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, backgroundColor: '#E2E8F0', borderWidth: 2, borderColor: '#FFF' },
  favoriteImage: { width: '100%', height: '100%', borderRadius: 35 },
  favoriteAvatarText: { fontSize: 24, fontWeight: '800' },
  qBadgeContainer: { position: 'absolute', top: -2, left: -2, backgroundColor: THEME.colors.qcallGreen, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF', elevation: 5 },
  qBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  favoriteName: { fontSize: 13, fontWeight: '800', color: THEME.colors.textMain, textAlign: 'center' },
  listHeader: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 10, height: 160 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 20, width: '48%', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4 },
  iconCircle: { width: 38, height: 38, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  actionText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  controlBar: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  contactCount: { fontSize: 12, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase' },
  sectionHeader: { backgroundColor: THEME.colors.bg, paddingHorizontal: 24, paddingVertical: 10, height: 44, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
  
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#FFF', height: 76, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }, 
  rowSelected: { backgroundColor: '#EFF6FF' },
  checkboxContainer: { marginRight: 15 },
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
  heartBtn: { padding: 8, marginRight: 6 },
  callBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: THEME.colors.primary, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  
  azSidebar: { position: 'absolute', right: 2, top: 180, bottom: 100, width: 24, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  azItem: { flex: 1, width: 30, alignItems: 'center', justifyContent: 'center' },
  azText: { fontSize: 10, fontWeight: '800', color: '#CBD5E1' },
  fab: { position: 'absolute', bottom: 110, right: 24, backgroundColor: THEME.colors.primary, width: 60, height: 60, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: THEME.colors.primary, shadowOpacity: 0.4, shadowRadius: 12 },
  skeletonAvatar: { width: 50, height: 50, borderRadius: 20, backgroundColor: '#E2E8F0', marginRight: 16 },
  skeletonText: { backgroundColor: '#E2E8F0', borderRadius: 4 },

  modalOverlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row' },
  rightMenuContainer: { width: '70%', height: '100%', backgroundColor: '#FFF', borderTopLeftRadius: 30, borderBottomLeftRadius: 30, paddingTop: Platform.OS === 'ios' ? 60 : 30, elevation: 15, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 15 },
  sideMenuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 15 },
  sideMenuTitle: { fontSize: 24, fontWeight: '900', color: THEME.colors.primary },
  closeSideMenu: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 20 },
  sideMenuContent: { paddingTop: 20 },
  sideMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, marginBottom: 8 },
  sideMenuIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  sideMenuText: { fontSize: 16, color: THEME.colors.textMain, fontWeight: '700' },

  exportModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  exportModalContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 28, padding: 24, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  exportIconHeader: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  exportModalTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  exportModalDesc: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 30, paddingHorizontal: 10, lineHeight: 22 },
  
  exportPrimaryBtn: { flexDirection: 'row', backgroundColor: '#4C1D95', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  exportPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '700', marginLeft: 10 },
  
  exportSecondaryBtn: { flexDirection: 'row', backgroundColor: '#F1F5F9', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  exportSecondaryText: { color: '#4C1D95', fontSize: 16, fontWeight: '700', marginLeft: 10 },
  
  exportCancelBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  exportCancelText: { color: '#94A3B8', fontSize: 15, fontWeight: '600' }
});