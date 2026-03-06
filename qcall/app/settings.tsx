import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, NativeModules, Modal, Vibration } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '../hooks/useAuth';
import { useCustomAlert } from '../context/AlertContext';

const { CallManagerModule } = NativeModules;

// 🟢 Pre-defined vibration patterns
const VIBRATION_PATTERNS = ['Default', 'Heartbeat', 'Rapid', 'SOS', 'Silent'];

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { showAlert } = useCustomAlert();

  // 🟢 STATES: Global Ringtone & Vibration
  const [ringtoneName, setRingtoneName] = useState('System Default');
  const [ringtoneUri, setRingtoneUri] = useState('default');
  const [vibrationPattern, setVibrationPattern] = useState('default');
  const [vibModalVisible, setVibModalVisible] = useState(false);

  // 🟢 LOAD INITIAL SETTINGS FROM KOTLIN
  useEffect(() => {
    const loadGlobalSettings = async () => {
      try {
        const settings = await CallManagerModule.getGlobalSettings();
        setRingtoneName(settings.ringtoneName);
        setRingtoneUri(settings.ringtoneUri);
        setVibrationPattern(settings.vibrationPattern);
      } catch (e) {
        console.log("Failed to load global settings", e);
      }
    };
    loadGlobalSettings();
  }, []);

  // 🟢 TRIGGER NATIVE RINGTONE PICKER
  const handlePickRingtone = async () => {
    try {
        const result = await CallManagerModule.openRingtonePicker(ringtoneUri);
        setRingtoneName(result.name);
        setRingtoneUri(result.uri);
        
        // Save immediately to Global Native SharedPreferences
        await CallManagerModule.saveGlobalSettings(result.uri, result.name, vibrationPattern);
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
    setVibModalVisible(false);
    
    // Live Preview
    Vibration.cancel(); 
    switch (formattedPattern) {
        case 'heartbeat':
            Vibration.vibrate([0, 100, 100, 100, 1000]);
            break;
        case 'rapid':
            Vibration.vibrate([0, 200, 200, 0, 200, 200]); 
            break;
        case 'sos':
            Vibration.vibrate([0, 200, 200, 200, 200, 200, 200, 500, 500, 500, 500, 500, 500, 200, 200, 200, 200, 200, 200]);
            break;
        case 'silent':
            break; 
        default:
            Vibration.vibrate([0, 1000, 1000]); 
            break;
    }

    // Save immediately to Global Native SharedPreferences
    await CallManagerModule.saveGlobalSettings(ringtoneUri, ringtoneName, formattedPattern);
  };

  // LOGOUT LOGIC
  const handleLogout = () => {
    showAlert(
      "Log Out", 
      "Are you sure you want to log out of QCall?", 
      "warning", 
      () => logout() 
    );
  };

  // PLACEHOLDER FOR PENDING TASKS
  const handleComingSoon = (featureName: string) => {
    showAlert(
        "Coming Soon", 
        `${featureName} is currently under development and will be available in the next update.`, 
        "success" 
    );
  };

  // REUSABLE SETTING ROW COMPONENT
  const SettingRow = ({ icon, color, label, subtext, onPress, isDestructive = false }: any) => (
    <TouchableOpacity 
        style={styles.row} 
        onPress={onPress} 
        activeOpacity={0.7}
    >
        <View style={[styles.iconContainer, { backgroundColor: isDestructive ? '#FEE2E2' : `${color}15` }]}>
            <Feather name={icon} size={20} color={isDestructive ? '#EF4444' : color} />
        </View>

        <View style={styles.textContainer}>
            <Text style={[styles.label, isDestructive && { color: '#EF4444' }]}>{label}</Text>
            {subtext && <Text style={styles.subtext} numberOfLines={1}>{subtext}</Text>}
        </View>

        {!isDestructive && <Feather name="chevron-right" size={20} color="#CBD5E1" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* HEADER */}
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#1E293B" />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>Settings</Text>
         <View style={{width: 40}} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* SECTION 1: ESSENTIALS */}
        <Text style={styles.sectionHeader}>GENERAL</Text>
        <View style={styles.card}>
            <SettingRow 
                icon="shield" 
                color="#EF4444" 
                label="Block Manager" 
                subtext="Manage blocked numbers"
                onPress={() => router.push('/blocked-list')} 
            />
            <View style={styles.divider} />
            <SettingRow 
                icon="user" 
                color="#3B82F6" 
                label="Caller ID" 
                subtext="Identification settings"
                onPress={() => handleComingSoon("Caller ID Settings")} 
            />
        </View>

        {/* 🟢 NEW SECTION: SOUNDS & VIBRATION */}
        <Text style={styles.sectionHeader}>CALL SOUNDS & VIBRATION</Text>
        <View style={styles.card}>
            <SettingRow 
                icon="music" 
                color="#8B5CF6" 
                label="Global Ringtone" 
                subtext={ringtoneName}
                onPress={handlePickRingtone} 
            />
            <View style={styles.divider} />
            <SettingRow 
                icon="radio" 
                color="#F59E0B" 
                label="Global Vibration" 
                subtext={vibrationPattern.charAt(0).toUpperCase() + vibrationPattern.slice(1)}
                onPress={() => setVibModalVisible(true)} 
            />
        </View>

        {/* SECTION 3: PREFERENCES */}
        <Text style={styles.sectionHeader}>PREFERENCES</Text>
        <View style={styles.card}>
            <SettingRow 
                icon="moon" 
                color="#6366F1" 
                label="Appearance" 
                subtext="Dark mode & themes"
                onPress={() => handleComingSoon("Theme Selection")} 
            />
            <View style={styles.divider} />
            <SettingRow 
                icon="lock" 
                color="#10B981" 
                label="Privacy & Security" 
                subtext="App lock & permissions"
                onPress={() => handleComingSoon("Privacy Center")} 
            />
        </View>

        {/* SECTION 4: SUPPORT */}
        <Text style={styles.sectionHeader}>SUPPORT</Text>
        <View style={styles.card}>
            <SettingRow 
                icon="info" 
                color="#64748B" 
                label="About QCall" 
                onPress={() => handleComingSoon("About Page")} 
            />
            <View style={styles.divider} />
            <SettingRow 
                icon="star" 
                color="#64748B" 
                label="Rate Us" 
                onPress={() => handleComingSoon("Rating")} 
            />
        </View>

        {/* LOGOUT */}
        <View style={[styles.card, { marginTop: 20 }]}>
            <SettingRow 
                icon="log-out" 
                color="#EF4444" 
                label="Log Out" 
                isDestructive={true}
                onPress={handleLogout} 
            />
        </View>

        <Text style={styles.versionText}>QCall v1.0.0 (Beta)</Text>
        <View style={{height: 40}} />

      </ScrollView>

      {/* 🟢 VIBRATION PICKER MODAL */}
      <Modal visible={vibModalVisible} transparent animationType="slide" onRequestClose={() => setVibModalVisible(false)}>
        <TouchableOpacity style={styles.vibOverlay} activeOpacity={1} onPress={() => setVibModalVisible(false)}>
          <View style={styles.vibSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.vibHandle} />
            <Text style={styles.vibTitle}>Global Vibration Pattern</Text>
            
            {VIBRATION_PATTERNS.map((pattern) => {
              const isSelected = vibrationPattern === pattern.toLowerCase();
              return (
                <TouchableOpacity 
                  key={pattern} 
                  style={styles.vibOption} 
                  onPress={() => handleSelectVibration(pattern)}
                >
                  <Text style={[styles.vibOptionText, isSelected && { color: '#0F172A', fontWeight: '700' }]}>
                    {pattern}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />}
                </TouchableOpacity>
              )
            })}
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' }, 
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F8FAFC',
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 10,
    marginTop: 25,
    letterSpacing: 1,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  
  textContainer: { flex: 1, paddingRight: 10 },
  label: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  subtext: { fontSize: 13, color: '#64748B', marginTop: 2 },

  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 70, 
  },

  versionText: {
    textAlign: 'center',
    color: '#CBD5E1',
    marginTop: 30,
    fontSize: 12,
    fontWeight: '600'
  },

  // 🟢 VIBRATION MODAL STYLES
  vibOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  vibSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 10 },
  vibHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  vibTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  vibOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  vibOptionText: { fontSize: 16, color: '#64748B', fontWeight: '500' }
});