import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// 🟢 Shared Logic
import { useSecureOps } from '../../context/SecureOperationsContext'; // Server
import { BlockService } from '../../services/BlockService'; // Local

const THEME = {
  danger: '#EF4444',
  text: '#1E293B',
  sub: '#64748B',
  bg: '#FFFFFF',
  success: '#10B981'
};

export default function CallerIdBlockScreen() {
  const router = useRouter();
  const { number, name } = useLocalSearchParams(); 
  
  // 🛠️ UPDATED: Added unblockNumber from Context
  const { blockNumber: serverBlock, unblockNumber: serverUnblock } = useSecureOps();
  
  const [loading, setLoading] = useState(false);
  const [alsoReport, setAlsoReport] = useState(true);
  const [isCurrentlyBlocked, setIsCurrentlyBlocked] = useState(false);

  // Handle params safely
  const cleanNumber = Array.isArray(number) ? number[0] : number || 'Unknown';
  const contactName = Array.isArray(name) ? name[0] : name || 'Unknown Caller';

  // Check initial block status
  useEffect(() => {
    const checkStatus = async () => {
      const blocked = await BlockService.isBlocked(cleanNumber);
      setIsCurrentlyBlocked(blocked);
    };
    if (cleanNumber !== 'Unknown') checkStatus();
  }, [cleanNumber]);

  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // 🔴 LOGIC: Block Number
  const handleBlock = async () => {
    if (!cleanNumber || cleanNumber === 'Unknown') return;
    setLoading(true);

    try {
        // 1. Server Block (Spam Report) - Do this first to ensure DB is updated
        const success = await serverBlock(cleanNumber, alsoReport);

        if (success) {
            // 2. Local Block (Instant Dialer Update)
            await BlockService.blockNumber(cleanNumber, contactName);
            setIsCurrentlyBlocked(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            Alert.alert("Blocked", `${cleanNumber} is now blocked.`, [
                { text: "Done", onPress: handleClose }
            ]);
        } else {
            Alert.alert("Error", "Server failed to block number.");
        }

    } catch (e) {
        Alert.alert("Error", "Could not block number.");
    } finally {
        setLoading(false);
    }
  };

  // 🟢 LOGIC: Unblock Number (New Sync Logic)
  const handleUnblock = async () => {
    if (!cleanNumber || cleanNumber === 'Unknown') return;
    setLoading(true);

    try {
        // 1. Server Unblock (Remove from MongoDB)
        const success = await serverUnblock(cleanNumber);

        if (success) {
            // 2. Local Unblock (Update Dialer List)
            await BlockService.unblockNumber(cleanNumber);
            setIsCurrentlyBlocked(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            Alert.alert("Unblocked", `${cleanNumber} has been removed from block list.`, [
                { text: "Done", onPress: handleClose }
            ]);
        } else {
            Alert.alert("Error", "Server failed to unblock number.");
        }
    } catch (e) {
        Alert.alert("Error", "Could not unblock number.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        
        {/* Header */}
        <View style={styles.header}>
            <MaterialCommunityIcons 
                name={isCurrentlyBlocked ? "shield-check" : "shield-alert"} 
                size={40} 
                color={isCurrentlyBlocked ? THEME.success : THEME.danger} 
            />
            <Text style={styles.title}>
                {isCurrentlyBlocked ? "Number Blocked" : "Block this number?"}
            </Text>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
            <Text style={styles.name}>{contactName}</Text>
            <Text style={styles.number}>{cleanNumber}</Text>
        </View>

        {!isCurrentlyBlocked && (
            <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Report as Spam</Text>
                <Switch 
                    value={alsoReport} 
                    onValueChange={setAlsoReport} 
                    trackColor={{ false: "#E2E8F0", true: "#FCA5A5" }}
                    thumbColor={alsoReport ? THEME.danger : "#f4f3f4"}
                />
            </View>
        )}

        {/* Actions */}
        <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: isCurrentlyBlocked ? THEME.text : THEME.danger }]} 
            onPress={isCurrentlyBlocked ? handleUnblock : handleBlock} 
            disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>
                {isCurrentlyBlocked ? "UNBLOCK NUMBER" : "BLOCK & REPORT"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>No, Cancel</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: THEME.text, marginTop: 10 },
  
  infoBox: { alignItems: 'center', marginBottom: 30 },
  name: { fontSize: 18, fontWeight: '600', color: THEME.text },
  number: { fontSize: 16, color: THEME.sub, marginTop: 4 },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 30, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16 },
  switchLabel: { fontSize: 16, fontWeight: '600', color: THEME.text },

  actionBtn: { paddingVertical: 16, width: '100%', alignItems: 'center', borderRadius: 16, marginBottom: 12 },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 1 },

  cancelBtn: { paddingVertical: 12 },
  cancelText: { color: THEME.sub, fontWeight: '600' }
});