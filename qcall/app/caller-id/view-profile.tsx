import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Dimensions, Linking, Platform 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { API_BASE_URL } from '../../constants/config';

// 🟢 Secure Ops Context
import { useSecureOps } from '../../context/SecureOperationsContext';

const { width } = Dimensions.get('window');

const THEME = {
  dark: '#0F172A',
  card: '#1E293B',
  primary: '#3B82F6',
  danger: '#EF4444',
  success: '#10B981',
  text: '#F8FAFC',
  subText: '#94A3B8'
};

export default function ViewCallerProfileScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();
  const { markAsSafe } = useSecureOps();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [spamScore, setSpamScore] = useState(0);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/'); 
    }
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
      case 'call':
        Linking.openURL(`tel:${cleanNumber}`);
        break;

      // 🚀 REDIRECTION TO DEFAULT SMS APP (Google Messages)
      case 'message':
        try {
          const smsUrl = `sms:${cleanNumber}`;
          const supported = await Linking.canOpenURL(smsUrl);
          if (supported) {
            await Linking.openURL(smsUrl);
          } else {
            Alert.alert("Error", "Aapka default messaging app nahi mil raha.");
          }
        } catch (error) {
          console.error("SMS Redirect Error:", error);
        }
        break;

      case 'whatsapp':
        Linking.openURL(`whatsapp://send?phone=${cleanNumber.replace(/[^\d]/g, '')}`);
        break;

      case 'block':
        router.push({ pathname: '/caller-id/block-number', params: { number: cleanNumber } });
        break;

      case 'report':
        router.push({ pathname: '/caller-id/spam-report', params: { number: cleanNumber } });
        break;
    }
  };

  const handleMarkAsSafe = async () => {
    const cleanNumber = Array.isArray(number) ? number[0] : number;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    Alert.alert("Mark as Safe", "Kya aap sure hain ki ye number safe hai?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Yes, I Trust", 
        onPress: async () => {
            const success = await markAsSafe(cleanNumber);
            if (success) {
                setSpamScore((prev) => Math.max(0, prev - 10)); 
                Alert.alert("Success", "Shukriya! Aapne directory behtar banane mein madad ki.");
            }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  const isSpam = spamScore > 50;
  const isVerified = profile?.isRegisteredUser; 

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View style={styles.bannerContainer}>
          <LinearGradient
            colors={isSpam ? ['#7F1D1D', '#EF4444'] : ['#1E3A8A', '#3B82F6']}
            style={styles.banner}
          />
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileHeader}>
          <View style={[styles.avatarContainer, isSpam && { borderColor: THEME.danger }]}>
            {profile?.photo ? (
              <Image source={{ uri: profile.photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholderAvatar, isSpam && { backgroundColor: '#FEE2E2' }]}>
                 <Feather name={isSpam ? "slash" : "user"} size={50} color={isSpam ? THEME.danger : "#CBD5E1"} />
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
            {isSpam ? (
               <View style={[styles.pill, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                 <Feather name="alert-triangle" size={12} color={THEME.danger} />
                 <Text style={[styles.pillText, { color: THEME.danger }]}>Likely Spam</Text>
               </View>
            ) : (
               <View style={[styles.pill, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                 <Feather name="shield" size={12} color={THEME.success} />
                 <Text style={[styles.pillText, { color: THEME.success }]}>Safe Caller</Text>
               </View>
            )}
            <View style={styles.pill}>
              <Feather name="map-pin" size={12} color={THEME.subText} />
              <Text style={styles.pillText}>{profile?.location || "India"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Reputation Score</Text>
            <Text style={[styles.scoreText, { color: isSpam ? THEME.danger : THEME.success }]}>
              {spamScore}% <Text style={{fontSize: 12, color: THEME.subText}}>{isSpam ? "RISK" : "SAFE"}</Text>
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
               colors={isSpam ? [THEME.danger, '#FCA5A5'] : [THEME.success, '#6EE7B7']}
               start={{x:0,y:0}} end={{x:1,y:0}}
               style={[styles.progressBarFill, { width: `${Math.min(spamScore, 100)}%` }]}
            />
          </View>
          <TouchableOpacity style={styles.safeBtn} onPress={handleMarkAsSafe}>
             <Feather name="thumbs-up" size={18} color={THEME.success} />
             <Text style={styles.safeBtnText}>I trust this number (Not Spam)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridContainer}>
          <TouchableOpacity style={styles.gridItem} onPress={() => handleAction('call')}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="call" size={24} color={THEME.primary} />
            </View>
            <Text style={styles.gridLabel}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => handleAction('message')}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="chatbubble" size={24} color={THEME.success} />
            </View>
            <Text style={styles.gridLabel}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => handleAction('whatsapp')}>
             <View style={[styles.iconBox, { backgroundColor: 'rgba(37, 211, 102, 0.15)' }]}>
               <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
             </View>
             <Text style={styles.gridLabel}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => handleAction('block')}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.dark },
  bannerContainer: { height: 160, width: '100%', position: 'relative' },
  banner: { flex: 1 },
  backBtn: { position: 'absolute', top: 50, left: 20, padding: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },
  profileHeader: { alignItems: 'center', marginTop: -60, paddingBottom: 20 },
  avatarContainer: { position: 'relative', marginBottom: 15 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: THEME.dark, backgroundColor: '#334155' },
  placeholderAvatar: { justifyContent: 'center', alignItems: 'center' },
  verifiedBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#FFF', borderRadius: 12 },
  name: { fontSize: 28, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  number: { fontSize: 18, color: THEME.subText, marginTop: 4, fontWeight: '500' },
  badgesRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: '600', color: '#CBD5E1' },
  card: { backgroundColor: THEME.card, marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  scoreText: { fontSize: 20, fontWeight: '800' },
  progressBarBg: { height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressBarFill: { height: '100%', borderRadius: 4 },
  safeBtn: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  safeBtnText: { color: THEME.success, fontWeight: '700', fontSize: 14 },
  gridContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 30 },
  gridItem: { alignItems: 'center', width: width / 4.8 },
  iconBox: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, marginHorizontal: 40, borderTopWidth: 1, borderColor: '#334155' },
  reportText: { color: THEME.subText, fontWeight: '600' }
});