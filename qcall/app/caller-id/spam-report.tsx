import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

export default function SpamReportScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Report Spam</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
           <Feather name="alert-triangle" size={40} color="#EF4444" />
        </View>
        <Text style={styles.numberText}>{number}</Text>
        <Text style={styles.subtitle}>Help the community by reporting this number.</Text>

        <TouchableOpacity style={styles.btnSpam}>
            <Text style={styles.btnText}>Mark as Sales/Ads</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSpam}>
            <Text style={styles.btnText}>Mark as Fraud/Scam</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15 },
  title: { fontSize: 20, fontWeight: '700' },
  content: { padding: 24, alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  numberText: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30, textAlign: 'center' },
  btnSpam: { width: '100%', padding: 16, backgroundColor: '#F3F4F6', borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '600', color: '#374151' }
});