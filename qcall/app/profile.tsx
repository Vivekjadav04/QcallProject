import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Image,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router'; 
import Svg, { Circle } from 'react-native-svg'; 
import { StatusBar } from 'expo-status-bar';

// 🟢 Import Hooks
import { useAuth } from '../hooks/useAuth'; 
import { useCustomAlert } from '../context/AlertContext';

const COLORS = {
  bg: '#FFFFFF',
  primary: '#0088FF', 
  textDark: '#212121',
  textGrey: '#757575',
  border: '#EEEEEE',
  gold: '#FFC107',
  green: '#4CAF50',
  brown: '#8D6E63',
  blue: '#2196F3',
  teal: '#009688',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showAlert } = useCustomAlert();

  // 🟢 1. PAYWALL LOGIC
  const handlePremiumFeature = (featureName: string) => {
    showAlert(
        "Premium Feature", 
        `"${featureName}" is available exclusively for Pro members.\n\nUpgrade now to unlock advanced insights and tools!`, 
        "warning" 
    );
  };

  // 🟢 2. PROGRESS LOGIC
  const calculateProgress = () => {
    if (!user) return 0;
    const fields = [user.firstName, user.lastName, user.email, user.phoneNumber, user.profilePhoto];
    const filled = fields.filter(f => f && f.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  };

  const progress = calculateProgress();
  const radius = 50; 
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const StatCard = ({ icon, color, number, label }: {icon: any, color: string, number: string, label: string}) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
        <Text style={styles.statNumber}>{number}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  // 🟢 3. UPDATED MENU ITEM (With Premium Crown & OnPress)
  const MenuItem = ({ icon, label, isLast, isPremium, onPress }: any) => (
    <TouchableOpacity 
        style={[styles.menuRow, isLast && { borderBottomWidth: 0 }]}
        onPress={onPress}
        activeOpacity={0.7}
    >
      <View style={styles.menuLeft}>
          <View style={styles.menuIconContainer}>
            <MaterialCommunityIcons name={icon} size={24} color="#333" />
          </View>
          <Text style={styles.menuText}>{label}</Text>
      </View>
      
      {/* Show Crown if Premium, otherwise Arrow */}
      {isPremium ? (
          <MaterialCommunityIcons name="crown" size={20} color={COLORS.gold} />
      ) : (
          <MaterialCommunityIcons name="chevron-right" size={24} color="#CCC" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const displayName = (user?.firstName && user?.lastName) ? `${user.firstName} ${user.lastName}` : user?.name || "Guest User";
  const initials = user?.firstName ? user.firstName.charAt(0).toUpperCase() : displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}> 
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* HEADER */}
      <View style={styles.customHeader}>
         <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
            <Ionicons name="arrow-back" size={24} color="black" />
         </TouchableOpacity>
         
         <Text style={styles.headerTitle}>{displayName}</Text>
         
         <TouchableOpacity onPress={() => router.push('/settings')} style={styles.headerIcon}>
            <Ionicons name="settings-outline" size={24} color="black" />
         </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Phone Number */}
        <Text style={styles.subHeaderPhone}>{user?.phoneNumber}</Text>

        {/* PROFILE CARD */}
        <View style={styles.completionCard}>
          <View style={styles.avatarWrapper}>
             <Svg height="110" width="110" style={styles.svgOverlay}>
                <Circle stroke="#E3F2FD" cx="55" cy="55" r={radius} strokeWidth={4} />
                <Circle
                  stroke={COLORS.primary} cx="55" cy="55" r={radius} strokeWidth={4}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  rotation="-90"
                  origin="55, 55"
                />
             </Svg>

             <View style={styles.imageContainer}>
                {user?.profilePhoto ? (
                  <Image source={{ uri: user.profilePhoto }} style={styles.realImage} />
                ) : (
                  <Text style={styles.initialsText}>{initials}</Text>
                )}
             </View>

             <View style={styles.percentageBadge}>
                <Text style={styles.percentageText}>{progress}%</Text>
             </View>
          </View>

          <View style={styles.photoStatusContainer}>
            <Ionicons name={user?.profilePhoto ? "checkmark-circle" : "camera"} size={14} color="#555" /> 
            <Text style={styles.addPhotoText}>
                {user?.profilePhoto ? " Lookin' good!" : " Add profile picture"}
            </Text>
          </View>

          <TouchableOpacity style={styles.completeBtn} onPress={() => router.push('/edit-profile')}> 
            <Text style={styles.completeBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* PREMIUM BANNER */}
        <TouchableOpacity style={styles.premiumBanner} onPress={() => handlePremiumFeature("Full Access")}>
          <View style={styles.premiumContent}>
             <MaterialCommunityIcons name="crown" size={24} color="#FFF" style={{marginRight: 10}} />
             <Text style={styles.premiumText}>Upgrade to Premium</Text>
          </View>
        </TouchableOpacity>

        {/* STATS SECTION */}
        <View style={styles.statsSection}>
          <View style={styles.statsHeader}>
            <TouchableOpacity style={styles.dateDropdown}>
              <Text style={styles.dateText}>Last 30 days</Text>
              <Ionicons name="chevron-down" size={16} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity>
               <Ionicons name="share-social-outline" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.gridContainer}>
            <View style={styles.gridRow}>
              <StatCard icon="shield-check-outline" color={COLORS.green} number="12" label="Spam calls identified" />
              <StatCard icon="clock-time-three-outline" color={COLORS.brown} number="4m" label="Time saved" />
            </View>
            <View style={styles.gridRow}>
              <StatCard icon="magnify" color={COLORS.blue} number="3" label="Unknown identified" />
              <StatCard icon="message-text-outline" color={COLORS.teal} number="8" label="Spam messages" />
            </View>
          </View>
        </View>

        {/* 🟢 4. WIRED MENU LIST */}
        <View style={styles.menuList}>
            {/* Real Navigation */}
            <MenuItem 
                icon="shield-off-outline" 
                label="Manage blocking" 
                onPress={() => router.push('/blocked-list')} 
            />
            
            {/* Premium Features */}
            <MenuItem 
                icon="email-outline" 
                label="Inbox cleaner" 
                isPremium={true}
                onPress={() => handlePremiumFeature("Inbox Cleaner")} 
            />
            <MenuItem 
                icon="face-man-profile" 
                label="Who viewed my profile" 
                isPremium={true}
                onPress={() => handlePremiumFeature("Profile Views")} 
            />
            <MenuItem 
                icon="magnify" 
                label="Who searched for me" 
                isPremium={true}
                onPress={() => handlePremiumFeature("Search Insights")} 
            />
            <MenuItem 
                icon="account-box-multiple-outline" 
                label="Contact requests" 
                isLast 
                isPremium={true}
                onPress={() => handlePremiumFeature("Contact Requests")} 
            />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  
  customHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  headerIcon: {
    padding: 8,
  },

  scrollContent: { paddingBottom: 40 },
  subHeaderPhone: { 
    textAlign: 'center', 
    color: COLORS.textGrey, 
    fontSize: 14, 
    marginBottom: 15,
    marginTop: 2 
  },
  
  completionCard: { alignItems: 'center', marginBottom: 20 },
  avatarWrapper: { width: 110, height: 110, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  svgOverlay: { position: 'absolute' },
  imageContainer: { 
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#E3F2FD', 
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden' 
  },
  realImage: { width: 90, height: 90 },
  initialsText: { fontSize: 36, fontWeight: 'bold', color: COLORS.primary },
  percentageBadge: {
    position: 'absolute', bottom: 0, backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3,
  },
  percentageText: { fontSize: 11, fontWeight: 'bold', color: COLORS.primary },
  
  photoStatusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  addPhotoText: { fontSize: 13, color: COLORS.textGrey, marginLeft: 5 },
  
  completeBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 40, borderRadius: 8 },
  completeBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  
  premiumBanner: {
    marginHorizontal: 16, marginBottom: 20, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF',
    borderWidth: 1, borderColor: '#F0F0F0', elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  premiumContent: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFA000' },
  premiumText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  
  statsSection: { paddingHorizontal: 16, marginBottom: 20 },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  dateDropdown: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 16, fontWeight: '600', marginRight: 5 },
  
  gridContainer: { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F0F0F0', elevation: 1 },
  statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  statNumber: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: COLORS.textGrey },
  
  menuList: { marginHorizontal: 16, borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 12, backgroundColor: '#FFF', overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconContainer: { width: 40 },
  menuText: { fontSize: 16, color: '#333', fontWeight: '500' },
});