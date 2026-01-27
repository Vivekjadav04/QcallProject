import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

export default function BlockNumberScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Block Number</Text>
      </View>

      <View style={styles.content}>
         <Text style={styles.warning}>Block this caller?</Text>
         <Text style={styles.number}>{number}</Text>
         <Text style={styles.desc}>
            They will not be able to call you. You can unblock them anytime in settings.
         </Text>

         <TouchableOpacity style={styles.blockBtn}>
            <Text style={styles.blockBtnText}>BLOCK</Text>
         </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15 },
  title: { fontSize: 20, fontWeight: '700' },
  content: { padding: 24, alignItems: 'center', marginTop: 40 },
  warning: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  number: { fontSize: 28, fontWeight: 'bold', color: '#111', marginBottom: 10 },
  desc: { fontSize: 14, color: '#666', marginBottom: 40, textAlign: 'center', paddingHorizontal: 20 },
  blockBtn: { backgroundColor: '#EF4444', paddingVertical: 16, paddingHorizontal: 60, borderRadius: 30 },
  blockBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});