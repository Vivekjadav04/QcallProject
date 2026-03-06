import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Image, NativeModules, Alert, ActivityIndicator, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';

const { CallManagerModule } = NativeModules;

const THEME = {
  bg: '#F8FAFC',
  primary: '#0F172A',
  accent: '#2563EB',
  white: '#FFFFFF',
  border: '#E2E8F0',
  textMain: '#1E293B',
  textSub: '#64748B'
};

export default function SaveContactScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Form States
  const [firstName, setFirstName] = useState((params.name as string) || '');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState((params.phone as string) || '');
  const [email, setEmail] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Account States
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      // Re-using the statistics function to get all logged-in accounts
      const results = await CallManagerModule.getAccountStatistics();
      setAccounts(results);
      if (results.length > 0) {
        // Default to Google if available, else Device
        const defaultAcc = results.find((a: any) => a.type === 'com.google') || results[0];
        setSelectedAccount(defaultAcc);
      }
    } catch (e) {
      console.error("Account load failed", e);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true, 
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  const handleSave = async () => {
    if (!firstName || !phone) {
      Alert.alert("Required Fields", "Please enter a First Name and Phone Number.");
      return;
    }

    setLoading(true);
    try {
      await CallManagerModule.saveContactToAccount(
        firstName,
        lastName,
        phone,
        email,
        selectedAccount?.name,
        selectedAccount?.type,
        imageBase64
      );
      Alert.alert("Success", "Contact saved successfully!");
      router.replace('/(tabs)/contacts'); // Go back to contacts list
    } catch (e) {
      Alert.alert("Failed", "Could not save contact. Make sure permissions are granted.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={26} color={THEME.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Contact</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={THEME.accent} /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Image Section */}
        <View style={styles.imageSection}>
          <TouchableOpacity style={styles.imageCircle} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.fullImage} />
            ) : (
              <View style={styles.placeholderIcon}>
                <Ionicons name="camera" size={32} color={THEME.accent} />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Account Selector Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Save To</Text>
          <TouchableOpacity style={styles.accountBox} onPress={() => setShowAccountSelector(true)}>
            <MaterialCommunityIcons name={selectedAccount?.type === 'device' ? "cellphone" : "google"} size={22} color={THEME.textSub} />
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{selectedAccount?.name || 'Loading accounts...'}</Text>
            </View>
            <Feather name="chevron-down" size={20} color={THEME.textSub} />
          </TouchableOpacity>
        </View>

        {/* Inputs Section */}
        <View style={styles.inputGroup}>
          <View style={styles.inputRow}>
            <Feather name="user" size={20} color={THEME.accent} style={styles.fieldIcon} />
            <TextInput style={styles.input} placeholder="First Name" value={firstName} onChangeText={setFirstName} />
          </View>
          <View style={[styles.inputRow, { marginLeft: 35 }]}>
            <TextInput style={styles.input} placeholder="Last Name" value={lastName} onChangeText={setLastName} />
          </View>
          <View style={styles.inputRow}>
            <Feather name="phone" size={20} color={THEME.accent} style={styles.fieldIcon} />
            <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
          <View style={styles.inputRow}>
            <Feather name="mail" size={20} color={THEME.accent} style={styles.fieldIcon} />
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
        </View>
      </ScrollView>

      {/* Account Selection Modal */}
      <Modal visible={showAccountSelector} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAccountSelector(false)}>
          <View style={styles.sheetContainer}>
            <Text style={styles.sheetTitle}>Choose storage account</Text>
            {accounts.map((acc, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={styles.sheetRow}
                onPress={() => { setSelectedAccount(acc); setShowAccountSelector(false); }}
              >
                <MaterialCommunityIcons name={acc.type === 'device' ? "cellphone" : "google"} size={24} color={THEME.textMain} />
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.sheetRowName}>{acc.name}</Text>
                  <Text style={styles.sheetRowType}>{acc.type === 'device' ? 'Internal Storage' : 'Google Account'}</Text>
                </View>
                {selectedAccount?.name === acc.name && <Ionicons name="checkmark-circle" size={24} color={THEME.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: THEME.border },
  headerTitle: { fontSize: 18, fontWeight: '700', color: THEME.textMain },
  closeBtn: { padding: 5 },
  saveBtnText: { color: THEME.accent, fontSize: 16, fontWeight: '800' },
  scrollContent: { paddingBottom: 40 },
  imageSection: { alignItems: 'center', marginVertical: 30 },
  imageCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: THEME.border },
  fullImage: { width: '100%', height: '100%' },
  placeholderIcon: { alignItems: 'center' },
  addPhotoText: { fontSize: 12, color: THEME.accent, fontWeight: '700', marginTop: 4 },
  section: { paddingHorizontal: 20, marginBottom: 25 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: THEME.textSub, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  accountBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: THEME.border },
  accountInfo: { flex: 1, marginLeft: 12 },
  accountName: { fontSize: 15, fontWeight: '600', color: THEME.textMain },
  inputGroup: { paddingHorizontal: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: THEME.border, marginBottom: 15, paddingBottom: 5 },
  fieldIcon: { marginRight: 15 },
  input: { flex: 1, fontSize: 16, color: THEME.textMain, paddingVertical: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: THEME.textSub, marginBottom: 20 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sheetRowName: { fontSize: 16, fontWeight: '600', color: THEME.textMain },
  sheetRowType: { fontSize: 12, color: THEME.textSub, marginTop: 2 }
});