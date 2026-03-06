import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Image,
  Platform,
  PermissionsAndroid,
  Modal,
  Animated,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router'; 
import Svg, { Circle } from 'react-native-svg'; 
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

// @ts-ignore
import CallLogs from 'react-native-call-log';

// 🟢 Import Hooks
import { useAuth } from '../hooks/useAuth'; 
import { useCustomAlert } from '../context/AlertContext';

const COLORS = {
  bg: '#FFFFFF',
  primary: '#0088FF', 
  textDark: '#212121',
  textGrey: '#757575',
  border: '#EEEEEE',
  gold: '#FFB300', 
  green: '#4CAF50',
  brown: '#8D6E63',
  blue: '#2196F3',
  teal: '#009688',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  purple: '#8B5CF6',
  lightGrey: '#F1F5F9',
  
  // Customization Colors
  customBg: '#EAF6E9',
  customBtn: '#74C365',
  customBorder: '#D1E8D5',
  customZero: '#C8E6C9'
};

const calculateTrend = (current: number, previous: number) => {
  if (previous === 0 && current === 0) return { text: 'No data', icon: null, color: 'rgba(255,255,255,0.7)', isChart: COLORS.textGrey };
  if (previous === 0) return { text: '↑ 100%', icon: 'arrow-up-right', color: '#FFF', isChart: COLORS.green };
  
  const diff = current - previous;
  const percentage = Math.round((diff / previous) * 100);
  
  if (percentage === 0) return { text: 'No change', icon: null, color: 'rgba(255,255,255,0.7)', isChart: COLORS.textGrey };
  if (percentage > 0) return { text: `↑ ${percentage}%`, icon: 'arrow-up-right', color: '#FFF', isChart: COLORS.green };
  return { text: `↓ ${Math.abs(percentage)}%`, icon: 'arrow-down-left', color: '#FFF', isChart: COLORS.danger };
};

const formatDuration = (seconds: number) => {
  if (seconds === 0) return "No data";
  if (seconds > 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

// 🟢 MASSIVE ANIMATED PHONES WITH RINGING RIPPLE EFFECT
const AnimatedMockPhone = React.memo(({ config, style, delay, sizeClass }: any) => {
  const floatY = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current; 

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -12, duration: 2200, easing: Easing.inOut(Easing.sin), delay, useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.timing(pulseAnim, { 
        toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), delay, useNativeDriver: true 
      })
    ).start();
  }, []);

  const isSmall = sizeClass === 'small';
  const isMid = sizeClass === 'mid';
  
  const avatarSize = isSmall ? 36 : isMid ? 50 : 70;
  const titleSize = isSmall ? 10 : isMid ? 13 : 18;
  const subSize = isSmall ? 7 : isMid ? 9 : 12;
  const iconBtnSize = isSmall ? 22 : isMid ? 32 : 44;
  const iconSize = isSmall ? 12 : isMid ? 18 : 24;

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  const existingTransform = style?.transform || [];

  return (
    <Animated.View style={[styles.mockPhoneBase, style, { transform: [...existingTransform, { translateY: floatY }] }]}>
      <LinearGradient colors={config.bg} style={styles.mockPhoneScreen}>
         <View style={{ height: isSmall ? 12 : 20, width: '100%', backgroundColor: 'rgba(0,0,0,0.15)', marginBottom: isSmall ? 10 : 25 }} />
         <View style={{ alignItems: 'center', flex: 1, paddingTop: 10 }}>
            <View style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize/2, backgroundColor: config.avatarBg, justifyContent: 'center', alignItems: 'center', marginBottom: 10, elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 }}>
               <Text style={{ color: '#FFF', fontSize: titleSize + 6, fontWeight: '900' }}>{config.initial}</Text>
            </View>
            <Text style={{ color: config.textColor, fontSize: titleSize, fontWeight: '900', marginBottom: 4 }}>{config.name}</Text>
            <Text style={{ color: config.textColor, opacity: 0.85, fontSize: subSize, fontWeight: '500' }}>Incoming call...</Text>
         </View>
         <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '85%', paddingBottom: isSmall ? 16 : 30 }}>
            <View style={{ width: iconBtnSize, height: iconBtnSize, borderRadius: iconBtnSize/2, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', elevation: 4 }}>
               <MaterialCommunityIcons name="phone-hangup" size={iconSize} color="#FFF" />
            </View>
            <View style={{ justifyContent: 'center', alignItems: 'center' }}>
               <Animated.View style={{
                 position: 'absolute', width: iconBtnSize, height: iconBtnSize, borderRadius: iconBtnSize/2,
                 backgroundColor: '#10B981', transform: [{ scale: pulseScale }], opacity: pulseOpacity
               }} />
               <View style={{ width: iconBtnSize, height: iconBtnSize, borderRadius: iconBtnSize/2, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', elevation: 4 }}>
                  <MaterialCommunityIcons name="phone" size={iconSize} color="#FFF" />
               </View>
            </View>
         </View>
      </LinearGradient>
    </Animated.View>
  );
});

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showAlert } = useCustomAlert();

  const [premiumModalVisible, setPremiumModalVisible] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState('');

  const [isCrunchingData, setIsCrunchingData] = useState(true);
  const [stats, setStats] = useState({
    spamCards: { current: 9, previous: 0 }, 
    blockedCards: { current: 0, previous: 0 }, 
    sim1: {
      total: { current: 0, previous: 0 },
      outgoing: { current: 0, previous: 0 },
      incoming: { current: 0, previous: 0 }
    },
    sim2: {
      total: { current: 0, previous: 0 },
      outgoing: { current: 0, previous: 0 },
      incoming: { current: 0, previous: 0 }
    },
    callTypes: {
      total: { current: 0, previous: 0 },
      incoming: { current: 0, previous: 0 },
      outgoing: { current: 0, previous: 0 },
      missed: { current: 0, previous: 0 },
      unanswered: { current: 0, previous: 0 }
    }
  });

  useEffect(() => {
    const loadRealCallStats = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setIsCrunchingData(false);
            return;
          }
        }

        const logs = await CallLogs.load(1000); 
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

        let cSim1 = { total: 0, out: 0, in: 0 };
        let pSim1 = { total: 0, out: 0, in: 0 };
        let cSim2 = { total: 0, out: 0, in: 0 };
        let pSim2 = { total: 0, out: 0, in: 0 };
        let cTypes = { total: 0, in: 0, out: 0, missed: 0, unans: 0 };
        let pTypes = { total: 0, in: 0, out: 0, missed: 0, unans: 0 };

        logs.forEach((log: any) => {
          const ts = parseInt(log.timestamp);
          const dur = parseInt(log.duration); 
          const type = log.type; 
          const simId = log.phoneAccountId; 

          const isCurrent = (now - ts) <= thirtyDaysMs;
          const isPrevious = (now - ts) > thirtyDaysMs && (now - ts) <= sixtyDaysMs;

          if (!isCurrent && !isPrevious) return;

          const isSim2 = simId && simId !== '0' && simId.length > 0;

          if (isCurrent) {
            cTypes.total++;
            if (type === 'INCOMING') { 
              cTypes.in++; 
              if(isSim2) { cSim2.in += dur; cSim2.total += dur; } else { cSim1.in += dur; cSim1.total += dur; }
            }
            if (type === 'OUTGOING') { 
              cTypes.out++; 
              if(isSim2) { cSim2.out += dur; cSim2.total += dur; } else { cSim1.out += dur; cSim1.total += dur; }
            }
            if (type === 'MISSED') cTypes.missed++;
            if (type === 'REJECTED' || type === 'BLOCKED') cTypes.unans++;
          } else if (isPrevious) {
            pTypes.total++;
            if (type === 'INCOMING') { 
              pTypes.in++; 
              if(isSim2) { pSim2.in += dur; pSim2.total += dur; } else { pSim1.in += dur; pSim1.total += dur; }
            }
            if (type === 'OUTGOING') { 
              pTypes.out++; 
              if(isSim2) { pSim2.out += dur; pSim2.total += dur; } else { pSim1.out += dur; pSim1.total += dur; }
            }
            if (type === 'MISSED') pTypes.missed++;
            if (type === 'REJECTED' || type === 'BLOCKED') pTypes.unans++;
          }
        });

        setStats(prev => ({
          ...prev,
          sim1: {
            total: { current: cSim1.total, previous: pSim1.total },
            outgoing: { current: cSim1.out, previous: pSim1.out },
            incoming: { current: cSim1.in, previous: pSim1.in }
          },
          sim2: {
            total: { current: cSim2.total, previous: pSim2.total },
            outgoing: { current: cSim2.out, previous: pSim2.out },
            incoming: { current: cSim2.in, previous: pSim2.in }
          },
          callTypes: {
            total: { current: cTypes.total, previous: pTypes.total },
            incoming: { current: cTypes.in, previous: pTypes.in },
            outgoing: { current: cTypes.out, previous: pTypes.out },
            missed: { current: cTypes.missed, previous: pTypes.missed },
            unanswered: { current: cTypes.unans, previous: pTypes.unans }
          }
        }));

      } catch (e) {
        console.log("Error fetching logs for analytics: ", e);
      } finally {
        setIsCrunchingData(false);
      }
    };

    loadRealCallStats();
  }, []);

  // Check if user is premium
  const isPremium = user?.accountType === 'gold' || user?.accountType === 'platinum' || user?.subscription?.activeFeatures?.includes('no_ads');

  const handlePremiumFeature = (featureName: string) => {
    setLockedFeatureName(featureName);
    setPremiumModalVisible(true);
  };

  const handleGoToUpgrade = () => {
    setPremiumModalVisible(false);
    router.push('/(tabs)/upgrade');
  };

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

  const MenuItem = ({ icon, label, isLast, isPremiumItem, onPress }: any) => (
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
      {isPremiumItem && !isPremium ? (
          <MaterialCommunityIcons name="crown" size={20} color={COLORS.gold} />
      ) : (
          <MaterialCommunityIcons name="chevron-right" size={24} color="#CCC" />
      )}
    </TouchableOpacity>
  );

  if (loading || isCrunchingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{marginTop: 10, color: COLORS.textGrey}}>Crunching your call data...</Text>
      </View>
    );
  }

  const displayName = (user?.firstName && user?.lastName) ? `${user.firstName} ${user.lastName}` : user?.name || "Guest User";
  const initials = user?.firstName ? user.firstName.charAt(0).toUpperCase() : displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}> 
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.customHeader}>
         <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
            <Ionicons name="arrow-back" size={24} color="black" />
         </TouchableOpacity>
         
         <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{displayName}</Text>
         </View>
         
         <TouchableOpacity onPress={() => router.push('/settings')} style={styles.headerIcon}>
            <Ionicons name="settings-outline" size={24} color="black" />
         </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subHeaderPhone}>{user?.phoneNumber}</Text>

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

          {/* 🟢 THIS BUTTON IS NOW UNCONDITIONALLY VISIBLE FOR EVERYONE */}
          <TouchableOpacity style={styles.upgradeProBtn} onPress={handleGoToUpgrade} activeOpacity={0.8}>
            <MaterialCommunityIcons name="crown" size={18} color="#78350F" style={{marginRight: 6}} />
            <Text style={styles.upgradeProBtnText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>

        {!isPremium && (
          <TouchableOpacity style={styles.premiumBanner} onPress={handleGoToUpgrade} activeOpacity={0.85}>
            <LinearGradient 
              colors={['#FFD700', '#FFB300', '#FF8F00']} 
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} 
              style={styles.premiumGradientContent}
            >
               <View style={styles.premiumBannerLeft}>
                 <View style={styles.crownCircle}>
                   <MaterialCommunityIcons name="crown" size={22} color="#FF9800" />
                 </View>
                 <Text style={styles.premiumText}>Go Premium</Text>
               </View>
               <Feather name="chevron-right" size={22} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.statsSection}>
          <View style={styles.statsHeader}>
            <TouchableOpacity style={styles.dateDropdown}>
              <Text style={styles.dateText}>Last 30 days</Text>
              <Ionicons name="chevron-down" size={16} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity><Ionicons name="share-social-outline" size={24} color="#000" /></TouchableOpacity>
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

        <View style={styles.menuList}>
            <MenuItem icon="shield-off-outline" label="Manage blocking" onPress={() => router.push('/blocked-list')} />
            <MenuItem icon="email-outline" label="Inbox cleaner" isPremiumItem={true} onPress={() => handlePremiumFeature("Inbox cleaner")} />
            <MenuItem icon="face-man-profile" label="Who viewed my profile" isPremiumItem={true} onPress={() => handlePremiumFeature("Profile views")} />
            <MenuItem icon="magnify" label="Who searched for me" isPremiumItem={true} onPress={() => handlePremiumFeature("Search insights")} />
            <MenuItem icon="account-box-multiple-outline" label="Contact requests" isLast isPremiumItem={true} onPress={() => handlePremiumFeature("Contact requests")} />
        </View>

        <View style={styles.warningGrid}>
          <View style={[styles.warningCard, { backgroundColor: COLORS.dangerBg, borderColor: '#FECACA' }]}>
            <View style={styles.warningHeaderRow}>
              <MaterialCommunityIcons name="shield-alert-outline" size={20} color={COLORS.danger} />
              <Text style={[styles.warningTitle, { color: COLORS.danger }]}>Spam calls</Text>
            </View>
            <Text style={styles.warningSubText}>Recognized by QCall</Text>
            <View style={styles.warningDataRow}>
              <Text style={[styles.warningBigNum, { color: COLORS.danger }]}>{stats.spamCards.current}</Text>
              {stats.spamCards.previous === 0 && stats.spamCards.current > 0 && (
                 <View>
                    <Text style={{color: COLORS.green, fontSize: 12, fontWeight: '700'}}>↑ 100%</Text>
                    <View style={{flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 12, marginTop: 2}}>
                      <View style={{width: 4, height: '40%', backgroundColor: '#94A3B8'}}/>
                      <View style={{width: 4, height: '70%', backgroundColor: '#94A3B8'}}/>
                      <View style={{width: 4, height: '100%', backgroundColor: '#94A3B8'}}/>
                    </View>
                 </View>
              )}
            </View>
          </View>

          <View style={[styles.warningCard, { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]}>
            <View style={styles.warningHeaderRow}>
              <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#FFF" />
              <Text style={[styles.warningTitle, { color: '#FFF' }]}>Blocked calls</Text>
            </View>
            <Text style={[styles.warningSubText, { color: 'rgba(255,255,255,0.8)' }]}>by QCall</Text>
            <Text style={[styles.warningBigNum, { color: '#FFF', marginVertical: 4 }]}>{stats.blockedCards.current}</Text>
            <Text style={{color: 'rgba(255,255,255,0.9)', fontSize: 11}}>We're here to protect you.</Text>
          </View>
        </View>

        <View style={styles.customizationWrapper}>
          <View style={styles.customizationHeader}>
            <View style={styles.storeIconContainer}>
              <MaterialCommunityIcons name="storefront-outline" size={24} color={COLORS.green} />
            </View>
            <View style={styles.customizationHeaderText}>
              <Text style={styles.customizationTitle}>Customization</Text>
              <Text style={styles.customizationSub}>Your personal QCall experience</Text>
            </View>
          </View>

          <View style={styles.phonesContainer}>
            <AnimatedMockPhone delay={0} sizeClass="small" style={styles.phoneFarLeft} config={{
               bg: ['#1E293B', '#0F172A'], textColor: '#FFF', avatarBg: '#8B5CF6', name: 'Mom', initial: 'M'
            }}/>
            <AnimatedMockPhone delay={600} sizeClass="small" style={styles.phoneFarRight} config={{
               bg: ['#FFEDD5', '#FDBA74'], textColor: '#9A3412', avatarBg: '#EA580C', name: 'Work', initial: 'W'
            }}/>
            <AnimatedMockPhone delay={200} sizeClass="mid" style={styles.phoneMidLeft} config={{
               bg: ['#DBEAFE', '#93C5FD'], textColor: '#1E3A8A', avatarBg: '#2563EB', name: 'Alex', initial: 'A'
            }}/>
            <AnimatedMockPhone delay={800} sizeClass="mid" style={styles.phoneMidRight} config={{
               bg: ['#064E3B', '#10B981'], textColor: '#FFF', avatarBg: '#047857', name: 'Dad', initial: 'D'
            }}/>
            <AnimatedMockPhone delay={400} sizeClass="large" style={styles.phoneCenter} config={{
               bg: ['#FF7E5F', '#FEB47B'], textColor: '#FFF', avatarBg: 'rgba(255,255,255,0.3)', name: 'Wifey ❤️', initial: 'W'
            }}/>
          </View>

          <View style={styles.customizationStatusRow}>
            <Text style={styles.customizationBigZero}>0</Text>
            <View style={styles.customizationStatusTextCol}>
              <Text style={styles.customizationStatusTitle}>No items</Text>
              <Text style={styles.customizationStatusSub}>You didn't use customization yet</Text>
              <View style={styles.customizationProgressBar}>
                 <View style={styles.customizationProgressFill} />
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.customizationBtn} activeOpacity={0.8} onPress={() => handlePremiumFeature("Custom Themes")}>
            <Text style={styles.customizationBtnText}>CONTINUE TO BE CREATIVE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.analyticsWrapper}>
          <Text style={styles.analyticsMainTitle}>My calls</Text>
          
          <View style={styles.durationBlock}>
            <Text style={styles.durationTitle}>Call duration (Sim 1)</Text>
            <Text style={styles.durationSub}>Time you spend on your calls</Text>
            
            <View style={styles.dashboardLayout}>
              <View style={[styles.dashCardFull, { backgroundColor: COLORS.blue }]}>
                 <View style={styles.dashCardTopRow}>
                    <View>
                      <Text style={styles.dashLabelFull}>Total duration</Text>
                      <Text style={styles.dashValueFull}>{formatDuration(stats.sim1.total.current)}</Text>
                    </View>
                    <View style={styles.dashIconCircle}>
                       <Feather name="clock" size={24} color={COLORS.blue} />
                    </View>
                 </View>
                 <View style={styles.dashTrendRow}>
                    <Text style={styles.dashTrendTextFull}>{calculateTrend(stats.sim1.total.current, stats.sim1.total.previous).text}</Text>
                    {calculateTrend(stats.sim1.total.current, stats.sim1.total.previous).icon && (
                      <Feather name={calculateTrend(stats.sim1.total.current, stats.sim1.total.previous).icon as any} size={16} color="#FFF" />
                    )}
                 </View>
              </View>
              
              <View style={styles.dashHalfRow}>
                <View style={[styles.dashCardHalf, { backgroundColor: COLORS.teal }]}>
                  <View style={styles.dashIconSmallCircle}>
                    <Feather name="arrow-up-right" size={16} color={COLORS.teal} />
                  </View>
                  <Text style={styles.dashLabelHalf}>Outgoing</Text>
                  <Text style={styles.dashValueHalf}>{formatDuration(stats.sim1.outgoing.current)}</Text>
                  <Text style={styles.dashTrendTextHalf}>{calculateTrend(stats.sim1.outgoing.current, stats.sim1.outgoing.previous).text}</Text>
                </View>
                
                <View style={[styles.dashCardHalf, { backgroundColor: COLORS.purple }]}>
                  <View style={styles.dashIconSmallCircle}>
                    <Feather name="arrow-down-left" size={16} color={COLORS.purple} />
                  </View>
                  <Text style={styles.dashLabelHalf}>Incoming</Text>
                  <Text style={styles.dashValueHalf}>{formatDuration(stats.sim1.incoming.current)}</Text>
                  <Text style={styles.dashTrendTextHalf}>{calculateTrend(stats.sim1.incoming.current, stats.sim1.incoming.previous).text}</Text>
                </View>
              </View>
            </View>
          </View>

          {stats.sim2.total.current > 0 && (
            <View style={styles.durationBlock}>
              <Text style={styles.durationTitle}>Call duration (Sim 2)</Text>
              <Text style={styles.durationSub}>Time you spend on your calls</Text>
              
              <View style={styles.dashboardLayout}>
                <View style={[styles.dashCardFull, { backgroundColor: COLORS.blue }]}>
                   <View style={styles.dashCardTopRow}>
                      <View>
                        <Text style={styles.dashLabelFull}>Total duration</Text>
                        <Text style={styles.dashValueFull}>{formatDuration(stats.sim2.total.current)}</Text>
                      </View>
                      <View style={styles.dashIconCircle}>
                         <Feather name="clock" size={24} color={COLORS.blue} />
                      </View>
                   </View>
                   <View style={styles.dashTrendRow}>
                      <Text style={styles.dashTrendTextFull}>{calculateTrend(stats.sim2.total.current, stats.sim2.total.previous).text}</Text>
                      {calculateTrend(stats.sim2.total.current, stats.sim2.total.previous).icon && (
                        <Feather name={calculateTrend(stats.sim2.total.current, stats.sim2.total.previous).icon as any} size={16} color="#FFF" />
                      )}
                   </View>
                </View>
                
                <View style={styles.dashHalfRow}>
                  <View style={[styles.dashCardHalf, { backgroundColor: COLORS.teal }]}>
                    <View style={styles.dashIconSmallCircle}>
                      <Feather name="arrow-up-right" size={16} color={COLORS.teal} />
                    </View>
                    <Text style={styles.dashLabelHalf}>Outgoing</Text>
                    <Text style={styles.dashValueHalf}>{formatDuration(stats.sim2.outgoing.current)}</Text>
                    <Text style={styles.dashTrendTextHalf}>{calculateTrend(stats.sim2.outgoing.current, stats.sim2.outgoing.previous).text}</Text>
                  </View>
                  
                  <View style={[styles.dashCardHalf, { backgroundColor: COLORS.purple }]}>
                    <View style={styles.dashIconSmallCircle}>
                      <Feather name="arrow-down-left" size={16} color={COLORS.purple} />
                    </View>
                    <Text style={styles.dashLabelHalf}>Incoming</Text>
                    <Text style={styles.dashValueHalf}>{formatDuration(stats.sim2.incoming.current)}</Text>
                    <Text style={styles.dashTrendTextHalf}>{calculateTrend(stats.sim2.incoming.current, stats.sim2.incoming.previous).text}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={styles.durationBlock}>
            <Text style={styles.durationTitle}>Call types</Text>
            <Text style={styles.durationSub}>Number of calls by call type</Text>
            <View style={styles.barsContainer}>
              {[
                { label: 'Total calls', key: 'total', color: COLORS.blue, icon: 'phone' },
                { label: 'Incoming', key: 'incoming', color: COLORS.teal, icon: 'phone-incoming' },
                { label: 'Outgoing', key: 'outgoing', color: COLORS.purple, icon: 'phone-outgoing' },
                { label: 'Missed', key: 'missed', color: COLORS.danger, icon: 'phone-missed' },
                { label: 'Unanswered', key: 'unanswered', color: '#D946EF', icon: 'phone-cancel' }
              ].map((item, index) => {
                const val = (stats.callTypes as any)[item.key];
                const trend = calculateTrend(val.current, val.previous);
                const maxTotal = stats.callTypes.total.current > 0 ? stats.callTypes.total.current : 1;
                const barWidth = (val.current / maxTotal) * 100;

                return (
                  <View key={index} style={styles.barRow}>
                    <View style={styles.barLabelWrap}>
                      <MaterialCommunityIcons name={item.icon as any} size={16} color={item.color} style={{marginRight: 6}} />
                      <Text style={styles.barLabelText}>{item.label}</Text>
                    </View>
                    <View style={styles.barTrack}>
                        <View style={[styles.barFill, { backgroundColor: item.color, width: `${barWidth}%` }]} />
                    </View>
                    <Text style={styles.barValueText}>{val.current}</Text>
                    <Text style={[styles.barTrendText, { color: trend.isChart }]}>{trend.text}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={premiumModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPremiumModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconRing}>
              <MaterialCommunityIcons name="crown" size={40} color={COLORS.gold} />
            </View>
            <Text style={styles.modalTitle}>Premium Feature</Text>
            <Text style={styles.modalDesc}>
              <Text style={{fontWeight: '700', color: COLORS.textDark}}>"{lockedFeatureName}"</Text> is an exclusive feature for Pro members. 
              Upgrade now to unlock advanced tools and take full control of your communication!
            </Text>
            
            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPremiumModalVisible(false)}>
                <Text style={styles.modalCancelText}>Maybe Later</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.modalUpgradeBtnWrap} onPress={handleGoToUpgrade}>
                <LinearGradient 
                  colors={['#FFD700', '#FFB300']} 
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} 
                  style={styles.modalUpgradeGradient}
                >
                  <Text style={styles.modalUpgradeText}>Go Premium</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    paddingHorizontal: 8,
    backgroundColor: '#FFF',
  },
  headerIcon: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, textAlign: 'center' },

  scrollContent: { paddingBottom: 40 },
  subHeaderPhone: { textAlign: 'center', color: COLORS.textGrey, fontSize: 14, marginBottom: 15, marginTop: 2 },
  
  completionCard: { alignItems: 'center', marginBottom: 20 },
  avatarWrapper: { width: 110, height: 110, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  svgOverlay: { position: 'absolute' },
  imageContainer: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  realImage: { width: 90, height: 90 },
  initialsText: { fontSize: 36, fontWeight: 'bold', color: COLORS.primary },
  percentageBadge: { position: 'absolute', bottom: 0, backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3 },
  percentageText: { fontSize: 11, fontWeight: 'bold', color: COLORS.primary },
  
  photoStatusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  addPhotoText: { fontSize: 13, color: COLORS.textGrey, marginLeft: 5 },
  
  completeBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 40, borderRadius: 8 },
  completeBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  
  // 🟢 NEW: "Upgrade to Pro" Button Styles
  upgradeProBtn: { 
    marginTop: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#FEF3C7', // Soft yellowish gold background
    paddingVertical: 8, 
    paddingHorizontal: 20, 
    borderRadius: 20, 
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  upgradeProBtnText: { color: '#B45309', fontWeight: '800', fontSize: 13, marginLeft: 6 }, // Dark amber text

  premiumBanner: { marginHorizontal: 16, marginBottom: 20, borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: "#FFB300", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  premiumGradientContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  premiumBannerLeft: { flexDirection: 'row', alignItems: 'center' },
  crownCircle: { backgroundColor: '#FFF', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  premiumText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  
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

  warningGrid: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 24 },
  warningCard: { width: '48%', padding: 16, borderRadius: 16, borderWidth: 1 },
  warningHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  warningTitle: { fontSize: 14, fontWeight: '700', marginLeft: 6 },
  warningSubText: { fontSize: 12, color: COLORS.textGrey },
  warningDataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  warningBigNum: { fontSize: 36, fontWeight: '900' },

  customizationWrapper: { backgroundColor: COLORS.customBg, marginHorizontal: 16, marginTop: 24, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.customBorder },
  customizationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  storeIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#A5D6A7', marginRight: 12 },
  customizationHeaderText: { flex: 1 },
  customizationTitle: { fontSize: 18, fontWeight: '800', color: COLORS.green },
  customizationSub: { fontSize: 13, color: COLORS.textGrey, marginTop: 2 },

  phonesContainer: { height: 360, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 24, marginTop: 20 },
  mockPhoneBase: { position: 'absolute', borderRadius: 24, borderWidth: 4, borderColor: '#FFF', overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 15, backgroundColor: '#FFF' },
  mockPhoneScreen: { flex: 1, alignItems: 'center' },
  
  phoneCenter: { width: 150, height: 300, zIndex: 5 },
  phoneMidLeft: { width: 120, height: 240, zIndex: 4, transform: [{translateX: -85}] },
  phoneMidRight: { width: 120, height: 240, zIndex: 4, transform: [{translateX: 85}] },
  phoneFarLeft: { width: 90, height: 180, zIndex: 3, transform: [{translateX: -145}] },
  phoneFarRight: { width: 90, height: 180, zIndex: 3, transform: [{translateX: 145}] },

  customizationStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.customBorder, marginBottom: 20 },
  customizationBigZero: { fontSize: 48, fontWeight: '700', color: COLORS.customZero, marginRight: 20 },
  customizationStatusTextCol: { justifyContent: 'center' },
  customizationStatusTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  customizationStatusSub: { fontSize: 13, color: COLORS.textGrey, marginTop: 2, marginBottom: 8 },
  customizationProgressBar: { width: 120, height: 6, backgroundColor: COLORS.customBorder, borderRadius: 3 },
  customizationProgressFill: { width: 0, height: '100%', backgroundColor: COLORS.green, borderRadius: 3 },
  
  customizationBtn: { backgroundColor: COLORS.customBtn, paddingVertical: 14, borderRadius: 25, alignItems: 'center', shadowColor: COLORS.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  customizationBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  analyticsWrapper: { backgroundColor: '#F8FAFC', marginHorizontal: 16, marginTop: 24, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  analyticsMainTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textDark, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 16, marginBottom: 20 },
  durationBlock: { marginBottom: 28 },
  durationTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  durationSub: { fontSize: 13, color: COLORS.textGrey, marginBottom: 16, marginTop: 2 },
  
  dashboardLayout: { width: '100%' },
  dashCardFull: { width: '100%', borderRadius: 16, padding: 20, marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 },
  dashCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dashLabelFull: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  dashValueFull: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  dashIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  dashTrendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 12 },
  dashTrendTextFull: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  dashHalfRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dashCardHalf: { width: '48%', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6 },
  dashIconSmallCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  dashLabelHalf: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  dashValueHalf: { color: '#FFF', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  dashTrendTextHalf: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  barsContainer: { marginTop: 8, backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  barLabelWrap: { width: 100, flexDirection: 'row', alignItems: 'center' },
  barLabelText: { fontSize: 13, color: COLORS.textDark, fontWeight: '600' },
  barTrack: { flex: 1, height: 10, backgroundColor: COLORS.lightGrey, borderRadius: 5, marginHorizontal: 12, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  barValueText: { width: 30, fontSize: 14, fontWeight: '800', color: COLORS.textDark, textAlign: 'right' },
  barTrendText: { width: 65, fontSize: 12, textAlign: 'right', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.2, shadowRadius: 20 },
  modalIconRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 4, borderColor: '#FEF3C7' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textDark, marginBottom: 12 },
  modalDesc: { fontSize: 14, color: COLORS.textGrey, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 10 },
  modalButtonRow: { flexDirection: 'row', width: '100%', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { color: COLORS.textGrey, fontWeight: '700', fontSize: 15 },
  modalUpgradeBtnWrap: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  modalUpgradeGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 14 },
  modalUpgradeText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});