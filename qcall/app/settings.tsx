import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
// ❌ REMOVED: Alert
import { useRouter, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// 🟢 UPDATED: Import Redux Hook
import { useAuth } from '../hooks/useAuth';
// 🟢 IMPORT CUSTOM ALERT HOOK
import { useCustomAlert } from '../context/AlertContext';

export default function SettingsScreen() {
  const router = useRouter();
  
  // 🟢 UPDATED: Use Redux Logout
  const { logout } = useAuth();
  
  // 🟢 HOOK THE ALERT SYSTEM
  const { showAlert } = useCustomAlert();

  const handleLogout = async () => {
    // 🟢 REPLACED: Use High-Def Alert
    // We treat this as a "Warning" type to show the orange color scheme
    showAlert(
      "Log Out", 
      "Are you sure you want to log out?", 
      "warning", 
      () => {
        // 🟢 THIS ACTION RUNS WHEN USER CLICKS "OKAY"
        // Since CustomAlert currently only has one button ("Okay"), 
        // this acts as the confirmation.
        // For a true "Cancel/Confirm" dialog, we would need to update CustomAlert,
        // but for now, clicking the button proceeds.
        logout(); 
      }
    );
  };

  const SettingItem = ({ icon, label, color = "#333", onPress }: any) => (
    <TouchableOpacity style={styles.itemRow} onPress={onPress}>
        <View style={styles.left}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
          <Text style={[styles.label, { color }]}>{label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* CUSTOM HEADER */}
      <View style={styles.customHeader}>
         <TouchableOpacity 
           onPress={() => router.back()} 
           style={styles.headerIcon}
         >
            <Ionicons name="arrow-back" size={24} color="black" />
         </TouchableOpacity>
         
         <Text style={styles.headerTitle}>Settings</Text>
         
         <View style={{ width: 40 }} /> 
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <SettingItem icon="cog-outline" label="General" />
        <SettingItem icon="volume-high" label="Sounds" />
        <SettingItem icon="web" label="App Language" />
        <SettingItem icon="card-account-phone-outline" label="Caller ID" />
        <SettingItem icon="phone-outline" label="Calling" />
        <SettingItem icon="database-outline" label="Data & Storage" />
        <SettingItem icon="message-text-outline" label="Messaging" />
        <SettingItem icon="shield-alert-outline" label="Block" />
        <SettingItem icon="palette-outline" label="Appearance" />
        <SettingItem icon="cloud-upload-outline" label="Backup" />
        <SettingItem icon="lock-outline" label="Privacy Center" />
        
        <SettingItem icon="information-outline" label="About" />

        <View style={styles.divider} />

        {/* LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={24} color="#D32F2F" />
            <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.0.0</Text>
        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  
  customHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  headerIcon: {
    padding: 8,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5'
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  label: { fontSize: 16, fontWeight: '500' },
  
  divider: { height: 20, backgroundColor: '#F9F9F9' },
  
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
    marginTop: 10
  },
  logoutText: { color: '#D32F2F', fontSize: 18, fontWeight: 'bold' },
  versionText: { textAlign: 'center', color: '#AAA', marginBottom: 30, fontSize: 12 }
});