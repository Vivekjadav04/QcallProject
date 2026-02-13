import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

// 🟢 Service Import
import { BlockService } from '../services/BlockService';

const THEME = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E293B',
  sub: '#64748B',
  danger: '#EF4444',
  border: '#E2E8F0',
  primary: '#0F172A'
};

export default function BlockedListScreen() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const data = await BlockService.getBlockedList();
    setList(data);
  };

  const handleUnblock = async (number: string) => {
    await BlockService.unblockNumber(number);
    loadData(); // Refresh list immediately
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Blocked Contacts</Text>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.number}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={
            <View style={styles.empty}>
                <MaterialCommunityIcons name="shield-off-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>No blocked numbers</Text>
                <Text style={styles.emptySub}>Calls from blocked numbers will be rejected automatically.</Text>
            </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.iconBox}>
                <Feather name="slash" size={20} color={THEME.danger} />
            </View>
            <View style={styles.info}>
                <Text style={styles.name}>{item.name || 'Unknown'}</Text>
                <Text style={styles.number}>{item.number}</Text>
            </View>
            <TouchableOpacity onPress={() => handleUnblock(item.number)} style={styles.unblockBtn}>
                <Text style={styles.btnText}>Unblock</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20, backgroundColor: THEME.bg },
  backBtn: { marginRight: 16, padding: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: '700', color: THEME.text },
  
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: THEME.border, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: THEME.text },
  number: { fontSize: 14, color: THEME.sub, marginTop: 2 },
  
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.border },
  btnText: { fontSize: 12, fontWeight: '600', color: THEME.text },
  
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 18, fontWeight: '700', color: THEME.text },
  emptySub: { marginTop: 8, fontSize: 14, color: THEME.sub, textAlign: 'center', paddingHorizontal: 40 }
});