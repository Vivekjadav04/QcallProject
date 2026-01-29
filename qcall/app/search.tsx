import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Keyboard, ScrollView, Platform 
} from 'react-native'; // 🟢 ADDED Platform HERE
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

// 🟢 Services
import { apiService } from '../services/api';

export default function SearchScreen() {
  const router = useRouter();
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (number.length < 3) return;
    
    Keyboard.dismiss();
    setLoading(true);
    setResult(null);
    setHasSearched(true);

    try {
      // Call the API we created earlier
      const data = await apiService.identifyNumber(number);
      setResult(data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Identify Number</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <Text style={styles.subtitle}>
            Enter a number to check the global QCall directory.
          </Text>
          
          {/* SEARCH BOX */}
          <View style={styles.searchBox}>
            <Feather name="search" size={20} color="#64748B" />
            <TextInput 
              style={styles.input}
              placeholder="Ex: +91 99043..."
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={number}
              onChangeText={setNumber}
              onSubmitEditing={handleSearch}
              autoFocus={true}
            />
            {number.length > 0 && (
              <TouchableOpacity onPress={() => setNumber('')}>
                 <Feather name="x" size={20} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* CHECK BUTTON */}
          <TouchableOpacity 
            style={[styles.btn, number.length < 3 && styles.btnDisabled]} 
            onPress={handleSearch}
            disabled={loading || number.length < 3}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnText}>Check Server</Text>
            )}
          </TouchableOpacity>

          {/* 🟢 RESULT CARD */}
          {result && (
            <View style={[styles.card, result.isSpam && styles.cardSpam]}>
              
              {/* Avatar Icon */}
              <View style={[styles.icon, result.isSpam ? styles.iconSpam : styles.iconSafe]}>
                 <Feather name={result.isSpam ? "shield-off" : "user-check"} size={32} color="#FFF" />
              </View>
              
              {/* Name & Status */}
              <Text style={styles.cardName}>
                {result.found ? result.name : "Unknown Caller"}
              </Text>
              
              <View style={[styles.badge, result.isSpam ? styles.badgeSpam : styles.badgeSafe]}>
                <Text style={[styles.badgeText, result.isSpam ? styles.textSpam : styles.textSafe]}>
                  {result.isSpam ? "LIKELY SPAM" : result.found ? "VERIFIED ID" : "NOT FOUND"}
                </Text>
              </View>

              {/* Technical Debug Info */}
              <View style={styles.debugBox}>
                <Text style={styles.debugLabel}>SERVER RESPONSE:</Text>
                <Text style={styles.debugText}>{JSON.stringify(result, null, 2)}</Text>
              </View>
            </View>
          )}

          {/* Not Found / Error State */}
          {hasSearched && !loading && !result && (
            <View style={styles.errorState}>
                <Feather name="wifi-off" size={32} color="#CBD5E1" />
                <Text style={styles.errorText}>No response from server.</Text>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  backBtn: { padding: 8, marginRight: 10, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  
  scrollContent: { padding: 20 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  
  searchBox: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', 
    borderRadius: 16, paddingHorizontal: 16, height: 56, 
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 
  },
  input: { flex: 1, marginLeft: 12, fontSize: 18, color: '#1E293B' },
  
  btn: { 
    backgroundColor: '#0F172A', height: 56, borderRadius: 16, 
    justifyContent: 'center', alignItems: 'center', 
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 
  },
  btnDisabled: { backgroundColor: '#94A3B8', elevation: 0 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  
  // RESULT CARD STYLES
  card: { 
    backgroundColor: '#FFF', marginTop: 30, borderRadius: 24, padding: 24, 
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 
  },
  cardSpam: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 2 },
  
  icon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconSafe: { backgroundColor: '#3B82F6' },
  iconSpam: { backgroundColor: '#EF4444' },
  
  cardName: { fontSize: 24, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 8 },
  
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeSafe: { backgroundColor: '#DBEAFE' },
  badgeSpam: { backgroundColor: '#FEE2E2' },
  
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  textSafe: { color: '#1E40AF' },
  textSpam: { color: '#991B1B' },
  
  debugBox: { 
    marginTop: 20, width: '100%', backgroundColor: '#F1F5F9', 
    padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' 
  },
  debugLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', marginBottom: 4 },
  debugText: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#334155' },
  
  errorState: { alignItems: 'center', marginTop: 40 },
  errorText: { color: '#94A3B8', marginTop: 10 }
});