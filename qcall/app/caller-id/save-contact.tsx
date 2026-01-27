import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

export default function SaveContactScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Contact</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.label}>Mobile Number</Text>
        <Text style={styles.number}>{number}</Text>
        <Text style={styles.hint}>Complete the form to save this number.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  title: { fontSize: 20, fontWeight: '700' },
  content: { padding: 24 },
  label: { fontSize: 14, color: '#666', marginBottom: 5 },
  number: { fontSize: 22, fontWeight: '600', color: '#007AFF', marginBottom: 8 },
  hint: { fontSize: 14, color: '#999' }
});