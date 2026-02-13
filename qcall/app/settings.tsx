import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '../hooks/useAuth';
import { useCustomAlert } from '../context/AlertContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { showAlert } = useCustomAlert();

  // 🟢 1. LOGOUT LOGIC
  const handleLogout = () => {
    showAlert(
      "Log Out", 
      "Are you sure you want to log out of QCall?", 
      "warning", 
      () => logout() 
    );
  };

  // 🟢 2. PLACEHOLDER FOR PENDING TASKS
  // This makes the app feel "finished" even if features aren't code yet.
  const handleComingSoon = (featureName: string) => {
    showAlert(
        "Coming Soon", 
        `${featureName} is currently under development and will be available in the next update.`, 
        "success" // Using green to make it feel positive
    );
  };

  // 🟢 3. REUSABLE SETTING ROW COMPONENT
  const SettingRow = ({ icon, color, label, subtext, onPress, isDestructive = false }: any) => (
    <TouchableOpacity 
        style={styles.row} 
        onPress={onPress} 
        activeOpacity={0.7}
    >
        {/* Icon Container */}
        <View style={[styles.iconContainer, { backgroundColor: isDestructive ? '#FEE2E2' : `${color}15` }]}>
            <Feather name={icon} size={20} color={isDestructive ? '#EF4444' : color} />
        </View>

        {/* Text */}
        <View style={styles.textContainer}>
            <Text style={[styles.label, isDestructive && { color: '#EF4444' }]}>{label}</Text>
            {subtext && <Text style={styles.subtext}>{subtext}</Text>}
        </View>

        {/* Chevron */}
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
                onPress={() => router.push('/blocked-list')} // 🟢 Wired to Real Screen
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

        {/* SECTION 2: PREFERENCES */}
        <Text style={styles.sectionHeader}>PREFERENCES</Text>
        <View style={styles.card}>
            <SettingRow 
                icon="moon" 
                color="#8B5CF6" 
                label="Appearance" 
                subtext="Dark mode & themes"
                onPress={() => handleComingSoon("Theme Selection")} 
            />
            <View style={styles.divider} />
            <SettingRow 
                icon="bell" 
                color="#F59E0B" 
                label="Notifications" 
                subtext="Ringtones & vibrations"
                onPress={() => handleComingSoon("Sound Settings")} 
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

        {/* SECTION 3: SUPPORT */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' }, // Slate-50 background
  
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
  
  textContainer: { flex: 1 },
  label: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  subtext: { fontSize: 13, color: '#64748B', marginTop: 2 },

  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 70, // Align with text, skipping icon
  },

  versionText: {
    textAlign: 'center',
    color: '#CBD5E1',
    marginTop: 30,
    fontSize: 12,
    fontWeight: '600'
  }
});