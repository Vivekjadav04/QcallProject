import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, 
  ActivityIndicator, Linking, Platform, NativeModules, Alert, RefreshControl, 
  Dimensions, Animated, Easing, Share, Modal, Switch, ToastAndroid, Vibration // 🟢 Added Vibration
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BlockService } from '../services/BlockService';
import { useSecureOps } from '../context/SecureOperationsContext';

const { CallManagerModule } = NativeModules;

const THEME = {
  bgStart: '#FFFFFF',
  bgEnd: '#F8FAFC',
  textMain: '#1E293B', 
  textSub: '#64748B', 
  primary: '#0F172A', 
  gold: '#D4AF37',    
  danger: '#EF4444',  
  success: '#10B981',
};

const getAvatarStyle = (name: string) => {
  const bgColors = ['#F1F5F9', '#EFF6FF', '#F0FDF4', '#FFF7ED', '#FAF5FF', '#FEF2F2', '#ECFEFF', '#FFFBEB'];
  const accentColors = ['#475569', '#2563EB', '#16A34A', '#EA580C', '#9333EA', '#0F172A', '#0891B2', '#D97706'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % bgColors.length;
  return { bg: bgColors[index], accent: accentColors[index] };
};

// 🟢 Pre-defined vibration patterns
const VIBRATION_PATTERNS = ['Default', 'Heartbeat', 'Rapid', 'SOS', 'Silent'];

export default function ContactDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contactId } = useLocalSearchParams();
  
  const [contact, setContact] = useState<Contacts.Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isBlocked, setIsBlocked] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false); 
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [alsoReport, setAlsoReport] = useState(true);
  const [processingAction, setProcessingAction] = useState(false); 

  // 🟢 STATES: Ringtone & Vibration
  const [ringtoneName, setRingtoneName] = useState('Default Ringtone');
  const [ringtoneUri, setRingtoneUri] = useState('default');
  const [vibrationPattern, setVibrationPattern] = useState('default');
  const [vibrationModalVisible, setVibrationModalVisible] = useState(false);

  const { blockNumber: serverBlock, unblockNumber: serverUnblock } = useSecureOps(); 

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
      ])
    ).start();

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true })
    ]).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContactData();
    }, [contactId])
  );

  const loadContactData = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted' && contactId) {
        const contactData = await Contacts.getContactByIdAsync(contactId as string, [
            Contacts.Fields.PhoneNumbers, Contacts.Fields.Image, Contacts.Fields.Emails, Contacts.Fields.Name
        ]);
        if (contactData) {
            setContact(contactData);
            
            if (contactData.phoneNumbers?.[0]?.number) {
                const num = contactData.phoneNumbers[0].number;
                
                // Check block status
                const blocked = await BlockService.isBlocked(num);
                setIsBlocked(blocked);

                // Fetch specific ringtone settings from Native SharedPreferences
                try {
                  const settings = await CallManagerModule.getContactSettings(num);
                  setRingtoneName(settings.ringtoneName);
                  setRingtoneUri(settings.ringtoneUri);
                  setVibrationPattern(settings.vibrationPattern);
                } catch (e) {
                  console.log("No custom settings found, using defaults");
                }
            }

            const storedFavs = await AsyncStorage.getItem('@qcall_favorites');
            if (storedFavs) {
                const favArray = JSON.parse(storedFavs);
                setIsFavorite(favArray.includes(contactId as string));
            }
        }
      }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); setRefreshing(false); }
  };

  // TRIGGER NATIVE RINGTONE PICKER
  const handlePickRingtone = async () => {
    try {
        const result = await CallManagerModule.openRingtonePicker(ringtoneUri);
        setRingtoneName(result.name);
        setRingtoneUri(result.uri);
        
        // Save immediately to Native
        const num = contact?.phoneNumbers?.[0]?.number;
        if (num) {
            await CallManagerModule.saveContactSettings(num, result.uri, result.name, vibrationPattern);
        }
    } catch (e: any) {
        if (e.message !== 'CANCELLED') {
            console.error("Ringtone picker error:", e);
        }
    }
  };

  // 🟢 HANDLE VIBRATION SELECTION & LIVE PREVIEW
  const handleSelectVibration = async (pattern: string) => {
      const formattedPattern = pattern.toLowerCase();
      setVibrationPattern(formattedPattern);
      setVibrationModalVisible(false);
      
      // 🟢 LIVE PREVIEW THE VIBRATION
      Vibration.cancel(); // Stop any current vibration
      switch (formattedPattern) {
          case 'heartbeat':
              Vibration.vibrate([0, 100, 100, 100, 1000]);
              break;
          case 'rapid':
              Vibration.vibrate([0, 200, 200, 0, 200, 200]); // Repeated twice for effect
              break;
          case 'sos':
              Vibration.vibrate([0, 200, 200, 200, 200, 200, 200, 500, 500, 500, 500, 500, 500, 200, 200, 200, 200, 200, 200]);
              break;
          case 'silent':
              break; // Do nothing
          default:
              Vibration.vibrate([0, 1000, 1000]); // Default system pattern
              break;
      }

      const num = contact?.phoneNumbers?.[0]?.number;
      if (num) {
          await CallManagerModule.saveContactSettings(num, ringtoneUri, ringtoneName, formattedPattern);
      }
  };

  const toggleFavorite = async () => {
    if (!contactId) return;
    Haptics.selectionAsync();

    try {
      const storedFavs = await AsyncStorage.getItem('@qcall_favorites');
      let favArray = storedFavs ? JSON.parse(storedFavs) : [];

      if (isFavorite) {
        favArray = favArray.filter((id: string) => id !== contactId);
        if (Platform.OS === 'android') ToastAndroid.show("Removed from Favorites", ToastAndroid.SHORT);
      } else {
        favArray.push(contactId);
        if (Platform.OS === 'android') ToastAndroid.show("Added to Favorites", ToastAndroid.SHORT);
      }

      await AsyncStorage.setItem('@qcall_favorites', JSON.stringify(favArray));
      setIsFavorite(!isFavorite);

    } catch (e) {
      console.log("Error toggling favorite", e);
    }
  };

  const executeBlock = async () => {
    const num = contact?.phoneNumbers?.[0]?.number;
    const name = contact?.name || 'Unknown';
    if (!num) return;

    setProcessingAction(true);
    try {
        const res = await serverBlock(num, alsoReport);
        if (res) {
          await BlockService.blockNumber(num, name);
          setIsBlocked(true);
          setBlockModalVisible(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    } catch (e) {
        Alert.alert("Error", "Could not block contact.");
    } finally {
        setProcessingAction(false);
    }
  };

  const handleUnblock = async () => {
    const num = contact?.phoneNumbers?.[0]?.number;
    if (!num) return;

    setProcessingAction(true);
    try {
        const success = await serverUnblock(num);
        if (success) {
            await BlockService.unblockNumber(num);
            setIsBlocked(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Alert.alert("Error", "Server sync failed. Please try again.");
        }
    } catch (e) {
        Alert.alert("Error", "Network error. Could not unblock.");
    } finally {
        setProcessingAction(false);
    }
  };

  const handleEdit = async () => {
    if (contactId) {
        Haptics.selectionAsync();
        try { 
            await CallManagerModule.editContactNative(contactId as string); 
        } catch (e) {
            Alert.alert("Error", "Could not open native contact editor.");
        }
    }
  };

  const handleDelete = () => {
    if (!contactId) return;
    Alert.alert(
      "Delete Contact",
      `Are you sure you want to permanently delete ${contact?.name || 'this contact'}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingAction(true);
              await CallManagerModule.deleteContactNative(contactId as string);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back(); 
            } catch (e) {
               Alert.alert("Error", "Could not delete contact. Ensure permissions are granted.");
               setProcessingAction(false);
            }
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    const num = contact?.phoneNumbers?.[0]?.number || '';
    const name = contact?.name || 'Unknown';
    try { await Share.share({ message: `Contact: ${name}\n${num}` }); } catch (error) {}
  };

  const makeCall = (num: string) => {
    const cleanNum = num.replace(/[^0-9+]/g, '');
    if (Platform.OS === 'android') {
        try { CallManagerModule.startCall(cleanNum); } 
        catch (e) { Linking.openURL(`tel:${cleanNum}`); }
    } else { Linking.openURL(`tel:${cleanNum}`); }
  };

  const sendMsg = async (num: string) => {
    if (!num) return;
    const cleanNum = num.replace(/[^0-9+]/g, '');
    const url = `sms:${cleanNum}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "No messaging application found.");
      }
    } catch (error) {
      console.error("SMS Redirect Error:", error);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={THEME.gold} /></View>;
  if (!contact) return <View style={styles.center}><Text style={{color: THEME.textSub}}>Contact not found</Text></View>;

  const primaryPhone = contact.phoneNumbers?.[0]?.number || "No Number";
  const initials = contact.name ? contact.name.charAt(0).toUpperCase() : "?";
  const dynamicStyle = getAvatarStyle(contact.name || '?');

  return (
    <View style={styles.container}>
      <StatusBar style="dark" /> 
      <LinearGradient colors={[THEME.bgStart, THEME.bgEnd]} style={styles.gradientBg}>
        
        <View style={[styles.header, { marginTop: insets.top }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.glassBtn}>
                <Feather name="arrow-left" size={24} color={THEME.textMain} />
            </TouchableOpacity>

            <View style={styles.headerRightActions}>
                <TouchableOpacity onPress={toggleFavorite} style={[styles.glassBtn, { marginRight: 10 }]}>
                    <MaterialCommunityIcons 
                        name={isFavorite ? "heart" : "heart-outline"} 
                        size={22} 
                        color={isFavorite ? THEME.danger : THEME.textMain} 
                    />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleEdit} style={styles.glassBtn}>
                    <Feather name="edit-2" size={20} color={dynamicStyle.accent} />
                </TouchableOpacity>
            </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadContactData(); }} />}>
            
            <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.pulseWrapper}>
                    <Animated.View style={[styles.pulseRing, { borderColor: dynamicStyle.accent, transform: [{ scale: pulseAnim }] }]} />
                    <View style={[styles.avatarShadow, { shadowColor: dynamicStyle.accent }]}>
                        {contact.imageAvailable && contact.image?.uri ? (
                            <Image source={{ uri: contact.image.uri }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: dynamicStyle.bg }]}>
                                <Text style={[styles.placeholderText, { color: dynamicStyle.accent }]}>{initials}</Text>
                            </View>
                        )}
                        <TouchableOpacity style={[styles.editBadge, { backgroundColor: dynamicStyle.accent }]} onPress={handleEdit}>
                            <MaterialCommunityIcons name="pencil" size={14} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.name}>{contact.name}</Text>
                <Text style={styles.number}>{primaryPhone}</Text>
                
                {isBlocked && (
                    <View style={styles.blockedBadge}>
                        <Feather name="slash" size={12} color={THEME.textMain} />
                        <Text style={styles.blockedText}>Blocked</Text>
                    </View>
                )}
            </Animated.View>

            <Animated.View style={[styles.gridContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <TouchableOpacity style={styles.gridItem} onPress={() => makeCall(primaryPhone)} activeOpacity={0.7}>
                    <View style={[styles.iconGlass, { shadowColor: '#3B82F6' }]}><Ionicons name="call" size={24} color="#3B82F6" /></View>
                    <Text style={styles.gridLabel}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gridItem} onPress={() => sendMsg(primaryPhone)} activeOpacity={0.7}>
                    <View style={[styles.iconGlass, { shadowColor: '#10B981' }]}><Ionicons name="chatbubble" size={24} color="#10B981" /></View>
                    <Text style={styles.gridLabel}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gridItem} onPress={() => Linking.openURL(`whatsapp://send?phone=${primaryPhone.replace(/[^0-9]/g, '')}`)} activeOpacity={0.7}>
                    <View style={[styles.iconGlass, { shadowColor: '#25D366' }]}><Ionicons name="logo-whatsapp" size={24} color="#25D366" /></View>
                    <Text style={styles.gridLabel}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gridItem} onPress={handleShare} activeOpacity={0.7}>
                    <View style={[styles.iconGlass, { shadowColor: dynamicStyle.accent }]}><Feather name="share-2" size={24} color={dynamicStyle.accent} /></View>
                    <Text style={styles.gridLabel}>Share</Text>
                </TouchableOpacity>
            </Animated.View>

            <View style={styles.detailsCard}>
                {contact.phoneNumbers?.map((p, i) => (
                    <View key={i} style={styles.row}>
                        <View style={styles.iconBox}><Feather name="smartphone" size={20} color={THEME.textSub} /></View>
                        <View style={styles.rowText}>
                            <Text style={styles.label}>{p.label || 'Mobile'}</Text>
                            <Text style={styles.value}>{p.number}</Text>
                        </View>
                        <View style={styles.rowActions}>
                            <TouchableOpacity style={styles.actionMini} onPress={() => sendMsg(p.number || '')}>
                                <Feather name="message-circle" size={18} color={THEME.textMain} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionMini, {backgroundColor: '#EFF6FF'}]} onPress={() => makeCall(p.number || '')}>
                                <Feather name="phone" size={18} color="#2563EB" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </View>

            {/* SOUNDS & HAPTICS CARD */}
            <View style={styles.detailsCard}>
                <Text style={styles.cardSectionTitle}>Sounds & Haptics</Text>
                
                <TouchableOpacity style={styles.settingsRow} onPress={handlePickRingtone}>
                    <View style={[styles.settingsIconBox, { backgroundColor: '#F5F3FF' }]}>
                        <Feather name="music" size={20} color="#8B5CF6" />
                    </View>
                    <View style={styles.settingsRowText}>
                        <Text style={styles.settingsLabel}>Ringtone</Text>
                        <Text style={styles.settingsValue} numberOfLines={1}>{ringtoneName}</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={THEME.textSub} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingsRow} onPress={() => setVibrationModalVisible(true)}>
                    <View style={[styles.settingsIconBox, { backgroundColor: '#FFFBEB' }]}>
                        <MaterialCommunityIcons name="vibrate" size={20} color="#F59E0B" />
                    </View>
                    <View style={styles.settingsRowText}>
                        <Text style={styles.settingsLabel}>Vibration</Text>
                        <Text style={styles.settingsValue}>{vibrationPattern.charAt(0).toUpperCase() + vibrationPattern.slice(1)}</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={THEME.textSub} />
                </TouchableOpacity>
            </View>

            <TouchableOpacity 
                style={[styles.blockBtn, isBlocked ? { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' } : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]} 
                onPress={() => isBlocked ? handleUnblock() : setBlockModalVisible(true)}
                disabled={processingAction}
            >
                {processingAction ? (
                  <ActivityIndicator color={isBlocked ? THEME.textMain : THEME.danger} size="small" />
                ) : (
                  <Text style={[styles.blockText, isBlocked ? { color: THEME.textMain } : { color: THEME.danger }]}>
                      {isBlocked ? "Unblock Contact" : "Block Contact"}
                  </Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={processingAction}>
                <Feather name="trash-2" size={18} color={THEME.danger} style={{marginRight: 8}} />
                <Text style={styles.deleteText}>Delete Contact</Text>
            </TouchableOpacity>

            <View style={{height: 50}} />
        </ScrollView>

        {/* BLOCK MODAL */}
        <Modal visible={blockModalVisible} transparent animationType="fade" onRequestClose={() => setBlockModalVisible(false)}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <MaterialCommunityIcons name="shield-alert" size={40} color={THEME.danger} />
                        <Text style={styles.modalTitle}>Block {contact.name}?</Text>
                    </View>
                    <Text style={styles.modalDesc}>They will not be able to call you or send you messages.</Text>
                    
                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Report as spam</Text>
                        <Switch 
                            value={alsoReport} 
                            onValueChange={setAlsoReport} 
                            trackColor={{ false: "#E2E8F0", true: "#FCA5A5" }}
                            thumbColor={alsoReport ? THEME.danger : "#f4f3f4"}
                        />
                    </View>

                    <TouchableOpacity style={styles.modalBlockBtn} onPress={executeBlock} disabled={processingAction}>
                        {processingAction ? <ActivityIndicator color="#FFF"/> : <Text style={styles.modalBlockText}>BLOCK & REPORT</Text>}
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setBlockModalVisible(false)}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* VIBRATION PICKER MODAL */}
        <Modal visible={vibrationModalVisible} transparent animationType="slide" onRequestClose={() => setVibrationModalVisible(false)}>
          <TouchableOpacity style={styles.vibOverlay} activeOpacity={1} onPress={() => setVibrationModalVisible(false)}>
            <View style={styles.vibSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.vibHandle} />
              <Text style={styles.vibTitle}>Vibration Pattern</Text>
              
              {VIBRATION_PATTERNS.map((pattern) => {
                const isSelected = vibrationPattern === pattern.toLowerCase();
                return (
                  <TouchableOpacity 
                    key={pattern} 
                    style={styles.vibOption} 
                    onPress={() => handleSelectVibration(pattern)}
                  >
                    <Text style={[styles.vibOptionText, isSelected && { color: THEME.primary, fontWeight: '700' }]}>
                      {pattern}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />}
                  </TouchableOpacity>
                )
              })}
            </View>
          </TouchableOpacity>
        </Modal>

      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bgStart },
  gradientBg: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 10, paddingTop: 10 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center' }, 
  glassBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  heroSection: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  pulseWrapper: { justifyContent: 'center', alignItems: 'center', marginBottom: 16, width: 140, height: 140 },
  pulseRing: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1, opacity: 0.6 },
  avatarShadow: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 40, fontWeight: '700' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  name: { fontSize: 28, fontWeight: '800', color: THEME.textMain, textAlign: 'center', letterSpacing: -0.5 },
  number: { fontSize: 16, color: THEME.textSub, marginTop: 4, fontWeight: '500' },
  blockedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 10, gap: 4 },
  blockedText: { color: THEME.textMain, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  gridContainer: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 30, paddingHorizontal: 10 },
  gridItem: { alignItems: 'center', width: 70 },
  iconGlass: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5, shadowOffset: { width: 0, height: 5 } },
  gridLabel: { color: THEME.textSub, fontSize: 12, fontWeight: '600' },
  
  detailsCard: { marginHorizontal: 24, backgroundColor: '#FFF', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 5, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  iconBox: { width: 40, alignItems: 'flex-start' },
  rowText: { flex: 1 },
  label: { fontSize: 12, color: THEME.textSub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  value: { fontSize: 16, color: THEME.textMain, fontWeight: '600' },
  rowActions: { flexDirection: 'row', gap: 10 },
  actionMini: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  
  // SOUNDS & HAPTICS STYLES
  cardSectionTitle: { fontSize: 14, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  settingsIconBox: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  settingsRowText: { flex: 1, paddingRight: 15 },
  settingsLabel: { fontSize: 16, fontWeight: '700', color: THEME.textMain, marginBottom: 2 },
  settingsValue: { fontSize: 14, color: THEME.textSub, fontWeight: '500' },

  blockBtn: { marginHorizontal: 40, paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  blockText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  deleteBtn: { flexDirection: 'row', marginHorizontal: 40, marginTop: 12, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FECACA' },
  deleteText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.5, color: THEME.danger },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', width: '85%', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10 },
  modalHeader: { alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: '700', marginTop: 10, color: THEME.danger },
  modalDesc: { fontSize: 14, color: THEME.textSub, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 30, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA' },
  switchLabel: { fontSize: 14, fontWeight: '700', color: THEME.danger },
  modalBlockBtn: { width: '100%', backgroundColor: THEME.danger, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12, shadowColor: THEME.danger, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  modalBlockText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  modalCancelBtn: { paddingVertical: 12 },
  modalCancelText: { color: THEME.textSub, fontWeight: '600' },

  // VIBRATION MODAL STYLES
  vibOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  vibSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 10 },
  vibHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  vibTitle: { fontSize: 20, fontWeight: '800', color: THEME.textMain, marginBottom: 20 },
  vibOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  vibOptionText: { fontSize: 16, color: THEME.textSub, fontWeight: '500' }
});