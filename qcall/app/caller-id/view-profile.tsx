import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

export default function ViewCallerProfileScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
       <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
             <Feather name="arrow-left" size={24} color="#FFF" />
          </TouchableOpacity>
       </View>

       <View style={styles.banner} />
       
       <View style={styles.avatarContainer}>
          <Image source={{ uri: 'https://via.placeholder.com/150' }} style={styles.avatar} />
       </View>
       
       <View style={styles.info}>
          <Text style={styles.name}>Unknown User</Text>
          <Text style={styles.number}>{number}</Text>
          <Text style={styles.location}>India • Mobile</Text>
       </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { position: 'absolute', top: 40, left: 20, zIndex: 10 },
  backBtn: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 20 },
  banner: { height: 140, backgroundColor: '#007AFF' },
  avatarContainer: { alignItems: 'center', marginTop: -50 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#FFF', backgroundColor: '#EEE' },
  info: { alignItems: 'center', marginTop: 15 },
  name: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  number: { fontSize: 18, color: '#555', marginTop: 5 },
  location: { fontSize: 14, color: '#999', marginTop: 5 }
});