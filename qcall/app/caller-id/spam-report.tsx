import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

// 🟢 1. Import Secure Ops
import { useSecureOps } from '../../context/SecureOperationsContext';

export default function SpamReportScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);

  // 🟢 2. Get the report function from context
  const { reportSpam } = useSecureOps();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const handleReport = async (category: string) => {
    if (!number) return;
    setLoading(true);

    const cleanNumber = Array.isArray(number) ? number[0] : number;

    // 🟢 3. Call the secure function
    // The Context handles the Token, API URL, and Auth errors automatically.
    const success = await reportSpam(cleanNumber, category);

    setLoading(false);

    if (success) {
      Alert.alert("Reported", `Marked as ${category}.`, [{ text: "OK", onPress: handleBack }]);
    } else {
      // If success is false, the Context usually alerts for Auth errors.
      // We add a generic fallback here just in case of server error.
      Alert.alert("Error", "Could not submit report. Please check your connection.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} disabled={loading}>
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

        {loading ? (
          <ActivityIndicator size="large" color="#EF4444" style={{ marginTop: 20 }} />
        ) : (
          <>
            <TouchableOpacity style={styles.btnSpam} onPress={() => handleReport('Sales/Ads')}>
                <Feather name="tag" size={20} color="#374151" style={{ marginRight: 10 }} />
                <Text style={styles.btnText}>Mark as Sales/Ads</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnSpam, styles.btnScam]} onPress={() => handleReport('Fraud/Scam')}>
                <Feather name="shield-off" size={20} color="#DC2626" style={{ marginRight: 10 }} />
                <Text style={[styles.btnText, { color: '#DC2626' }]}>Mark as Fraud/Scam</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15 },
  title: { fontSize: 20, fontWeight: '700' },
  content: { padding: 24, alignItems: 'center', marginTop: 10 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  numberText: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 40, textAlign: 'center' },
  btnSpam: { width: '100%', padding: 18, backgroundColor: '#F3F4F6', borderRadius: 12, marginBottom: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  btnScam: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  btnText: { fontSize: 16, fontWeight: '600', color: '#374151' }
});