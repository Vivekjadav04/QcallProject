import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

// 🟢 1. Import the new Secure Ops Hook
import { useSecureOps } from '../../context/SecureOperationsContext';

export default function BlockNumberScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();
  
  // 🟢 2. Get the blockNumber function from context
  const { blockNumber } = useSecureOps();
  
  const [loading, setLoading] = useState(false);
  const [alsoReport, setAlsoReport] = useState(true);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleBlock = async () => {
    setLoading(true);

    // Ensure number is a string
    const cleanNumber = Array.isArray(number) ? number[0] : number;

    // 🟢 3. Call the secure function
    // The Context handles the Token, API URL, and Errors automatically.
    const success = await blockNumber(cleanNumber, alsoReport);

    setLoading(false);

    // 🟢 4. Handle Success UI
    // If 'success' is false, the Context has already shown an error Alert.
    if (success) {
      Alert.alert("Blocked", `${cleanNumber} has been blocked.`, [
        { text: "OK", onPress: handleBack }
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
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

        <View style={styles.row}>
          <Text style={styles.label}>Also report as spam</Text>
          <Switch 
            value={alsoReport} 
            onValueChange={setAlsoReport} 
            trackColor={{ false: "#767577", true: "#EF4444" }}
          />
        </View>

        <TouchableOpacity style={styles.blockBtn} onPress={handleBlock} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.blockBtnText}>BLOCK CONTACT</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15 },
  title: { fontSize: 20, fontWeight: '700' },
  content: { padding: 24, alignItems: 'center', marginTop: 20 },
  warning: { fontSize: 18, fontWeight: '600', marginBottom: 10, color: '#333' },
  number: { fontSize: 28, fontWeight: 'bold', color: '#EF4444', marginBottom: 10 },
  desc: { fontSize: 14, color: '#666', marginBottom: 40, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 30, paddingHorizontal: 10 },
  label: { fontSize: 16, fontWeight: '500', color: '#333' },
  blockBtn: { backgroundColor: '#EF4444', paddingVertical: 16, width: '100%', alignItems: 'center', borderRadius: 15, elevation: 2 },
  blockBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});