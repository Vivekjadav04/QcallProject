import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, 
  ActivityIndicator, Dimensions, Linking, Platform, Modal 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { API_BASE_URL } from '../../constants/config';

// 🟢 Secure Ops Context (API calls only, no direct DB interaction)
import { useSecureOps } from '../../context/SecureOperationsContext';

const { width } = Dimensions.get('window');

const THEME = {
  background: '#F8FAFC', 
  card: '#FFFFFF',       
  primary: '#3B82F6',
  danger: '#EF4444',
  warning: '#F59E0B',    // Amber/Yellow for moderate risk
  success: '#10B981',
  text: '#0F172A',       
  subText: '#64748B',    
  border: '#E2E8F0'      
};

export default function ViewCallerProfileScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();
  const { markAsSafe } = useSecureOps();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [spamScore, setSpamScore] = useState(0);

  // 🟢 CUSTOM POPUP STATE
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupConfig, setPopupConfig] = useState({ type: 'info', title: '', message: '' });

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/'); 
  };

  useEffect(() => {
    fetchProfileData();
  }, [number]);

  const fetchProfileData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/contacts/identify?number=${number}`);
      const data = await response.json();
      
      if (response.ok && data.found) {
        setProfile(data);
        setSpamScore(data.spamScore || 0);
      } else {
        setProfile({ name: "Unknown Caller", isUnknown: true });
      }
    } catch (error) {
      console.log("Error fetching profile:", error);
      setProfile({ name: "Unknown (Offline)", isUnknown: true });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    Haptics.selectionAsync();
    const cleanNumber = Array.isArray(number) ? number[0] : number;

    switch (action) {
      case 'call': Linking.openURL(`tel:${cleanNumber}`); break;
      case 'message':
        try {
          const smsUrl = `sms:${cleanNumber}`;
          if (await Linking.canOpenURL(smsUrl)) await Linking.openURL(smsUrl);
          else showCustomPopup('error', 'Error', 'Default messaging app not found.');
        } catch (error) {}
        break;
      case 'whatsapp': Linking.openURL(`whatsapp://send?phone=${cleanNumber.replace(/[^\d]/g, '')}`); break;
      case 'block': router.push({ pathname: '/caller-id/block-number', params: { number: cleanNumber } }); break;
      case 'report': router.push({ pathname: '/caller-id/spam-report', params: { number: cleanNumber } }); break;
    }
  };

  // 🟢 BEAUTIFUL POPUP TRIGGER
  const showCustomPopup = (type: 'confirm' | 'success' | 'error' | 'info', title: string, message: string) => {
    setPopupConfig({ type, title, message });
    setPopupVisible(true);
  };

  const handleMarkAsSafeClick = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showCustomPopup('confirm', 'Mark as Safe', 'Are you sure you want to trust this number? This will improve its score for everyone.');
  };

  const executeMarkAsSafe = async () => {
    setPopupVisible(false); // Hide confirm popup
    const cleanNumber = Array.isArray(number) ? number[0] : number;
    
    // Call our Node API via Context
    const success = await markAsSafe(cleanNumber);
    
    setTimeout(() => {
        if (success) {
            // Drop the spam score, which dynamically raises the Trust Score!
            setSpamScore((prev) => Math.max(0, prev - 20)); 
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showCustomPopup('success', 'Thank You!', 'You have successfully helped improve the QCall directory.');
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            // Beautiful error handling instead of raw code crashes
            showCustomPopup('error', 'Service Unavailable', 'Our servers are taking a short break. Please try marking this safe again later!');
        }
    }, 400);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  // 🟢 DYNAMIC TRUST SCORE LOGIC (0% to 100%)
  const trustScore = 100 - spamScore; 
  let scoreColor = THEME.success;
  let scoreText = 'SAFE';
  let progressColors: readonly [string, string] = [THEME.success, '#6EE7B7'];
  let tagText = 'Safe Caller';
  let tagIcon = 'shield';

  if (trustScore < 40) {
      scoreColor = THEME.danger;
      scoreText = 'HIGH RISK';
      progressColors = [THEME.danger, '#FCA5A5'];
      tagText = profile?.spamType || 'Likely Spam';
      tagIcon = 'alert-triangle';
  } else if (trustScore < 80) {
      scoreColor = THEME.warning;
      scoreText = 'MODERATE';
      progressColors = [THEME.warning, '#FDE68A'];
      tagText = profile?.spamType || 'Caution';
      tagIcon = 'alert-circle';
  }

  const isVerified = profile?.isRegisteredUser; 

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.bannerContainer}>
          <LinearGradient
            colors={trustScore < 40 ? ['#EF4444', '#FCA5A5'] : trustScore < 80 ? ['#F59E0B', '#FCD34D'] : ['#3B82F6', '#93C5FD']}
            style={styles.banner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileHeader}>
          <View style={[styles.avatarContainer, { borderColor: scoreColor }]}>
            {profile?.photo ? (
              <Image source={{ uri: profile.photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholderAvatar, { backgroundColor: trustScore < 40 ? '#FEE2E2' : '#F1F5F9' }]}>
                 <Feather name={trustScore < 40 ? "slash" : "user"} size={50} color={trustScore < 40 ? THEME.danger : "#94A3B8"} />
              </View>
            )}
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={24} color={THEME.primary} />
              </View>
            )}
          </View>

          <Text style={styles.name}>{profile?.name || "Unknown Caller"}</Text>
          <Text style={styles.number}>{number}</Text>
          
          <View style={styles.badgesRow}>
             <View style={[styles.pill, { backgroundColor: scoreColor + '20' }]}>
               <Feather name={tagIcon as any} size={12} color={scoreColor} />
               <Text style={[styles.pillText, { color: scoreColor }]}>{tagText}</Text>
             </View>
            
            <View style={styles.pill}>
              <Feather name="map-pin" size={12} color={THEME.subText} />
              <Text style={styles.pillText}>{profile?.location || "India"}</Text>
            </View>
          </View>
        </View>

        {/* 🟢 DYNAMIC REPUTATION CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Trust Score</Text>
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {trustScore}% <Text style={{fontSize: 12, color: THEME.subText}}>{scoreText}</Text>
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
               colors={progressColors}
               start={{x:0,y:0}} end={{x:1,y:0}}
               style={[styles.progressBarFill, { width: `${Math.max(5, trustScore)}%` }]} 
            />
          </View>
          
          {/* ALWAYS VISIBLE TRUST BUTTON */}
          <TouchableOpacity style={styles.safeBtn} onPress={handleMarkAsSafeClick}>
             <Feather name="thumbs-up" size={18} color={THEME.success} />
             <Text style={styles.safeBtnText}>I trust this number (Not Spam)</Text>
          </TouchableOpacity>
        </View>

        {/* Action Grid */}
        <View style={styles.gridContainer}>
          <TouchableOpacity style={styles.gridItem} onPress={() => handleAction('call')}>
            <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="call" size={24} color={THEME.primary} />
            </View>
            <Text style={styles.gridLabel}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => handleAction('message')}>
            <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="chatbubble" size={24} color={THEME.success} />
            </View>
            <Text style={styles.gridLabel}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => handleAction('whatsapp')}>
             <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
               <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
             </View>
             <Text style={styles.gridLabel}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => handleAction('block')}>
            <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
              <Feather name="slash" size={24} color={THEME.danger} />
            </View>
            <Text style={styles.gridLabel}>Block</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.reportBtn} onPress={() => handleAction('report')}>
          <Feather name="flag" size={20} color={THEME.subText} />
          <Text style={styles.reportText}>Report as Spam / Fraud</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* 🟢 BEAUTIFUL CUSTOM MODAL */}
      <Modal transparent visible={popupVisible} animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                
                <View style={[styles.modalIconBox, { backgroundColor: popupConfig.type === 'error' ? '#FEE2E2' : popupConfig.type === 'success' ? '#D1FAE5' : '#FEF3C7' }]}>
                    <Feather 
                        name={popupConfig.type === 'error' ? 'wifi-off' : popupConfig.type === 'success' ? 'check-circle' : 'help-circle'} 
                        size={32} 
                        color={popupConfig.type === 'error' ? THEME.danger : popupConfig.type === 'success' ? THEME.success : THEME.warning} 
                    />
                </View>

                <Text style={styles.modalTitle}>{popupConfig.title}</Text>
                <Text style={styles.modalMessage}>{popupConfig.message}</Text>

                <View style={styles.modalActionRow}>
                    {popupConfig.type === 'confirm' ? (
                        <>
                            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setPopupVisible(false)}>
                                <Text style={styles.modalBtnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalBtnConfirm} onPress={executeMarkAsSafe}>
                                <Text style={styles.modalBtnConfirmText}>Yes, I Trust</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity style={[styles.modalBtnConfirm, { width: '100%', backgroundColor: popupConfig.type === 'error' ? THEME.danger : THEME.primary }]} onPress={() => setPopupVisible(false)}>
                            <Text style={styles.modalBtnConfirmText}>Got it</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  bannerContainer: { height: 160, width: '100%', position: 'relative' },
  banner: { flex: 1 },
  backBtn: { position: 'absolute', top: 50, left: 20, padding: 8, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20 },
  profileHeader: { alignItems: 'center', marginTop: -60, paddingBottom: 20 },
  avatarContainer: { position: 'relative', marginBottom: 15, borderRadius: 60, borderWidth: 4, backgroundColor: '#FFF' },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  placeholderAvatar: { justifyContent: 'center', alignItems: 'center' },
  verifiedBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FFF', borderRadius: 12 },
  name: { fontSize: 28, fontWeight: '800', color: THEME.text, textAlign: 'center' },
  number: { fontSize: 18, color: THEME.subText, marginTop: 4, fontWeight: '500' },
  badgesRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: '700' },
  
  card: { backgroundColor: THEME.card, marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: THEME.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: THEME.text },
  scoreText: { fontSize: 20, fontWeight: '900' },
  progressBarBg: { height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  progressBarFill: { height: '100%', borderRadius: 5 },
  
  safeBtn: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, backgroundColor: '#F0FDF4', borderRadius: 16, borderWidth: 1, borderColor: '#A7F3D0' },
  safeBtnText: { color: THEME.success, fontWeight: '700', fontSize: 14 },
  
  gridContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 30 },
  gridItem: { alignItems: 'center', width: width / 4.8 },
  iconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridLabel: { color: THEME.text, fontSize: 12, fontWeight: '600' },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, marginHorizontal: 40, borderTopWidth: 1, borderColor: THEME.border },
  reportText: { color: THEME.subText, fontWeight: '600' },

  // 🟢 MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  modalIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: THEME.text, marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 15, color: THEME.subText, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalActionRow: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalBtnCancelText: { color: THEME.subText, fontWeight: '700', fontSize: 15 },
  modalBtnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: THEME.primary, alignItems: 'center' },
  modalBtnConfirmText: { color: '#FFF', fontWeight: '700', fontSize: 15 }
});