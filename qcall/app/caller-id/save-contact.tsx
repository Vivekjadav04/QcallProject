import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert, ScrollView, Platform 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';

export default function SaveContactScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  
  // Account State
  const [accounts, setAccounts] = useState<Contacts.Container[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Smart Back Logic
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/'); 
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        fetchAccounts();
      } else {
        Alert.alert("Permission Denied", "We need access to contacts to save this number.");
      }
    })();
  }, []);

  const fetchAccounts = async () => {
    try {
      if (Platform.OS === 'android') {
        // Fetch accounts (Google, Samsung, Device, etc.)
        const containers = await Contacts.getContainersAsync({
            contactType: Contacts.ContactTypes.Person
        } as any);

        // Filter for likely writable accounts
        const writableAccounts = containers.filter(c => 
           c.name.includes('@') || 
           c.name.toLowerCase().includes('phone') || 
           c.name.toLowerCase().includes('device') ||
           c.name.toLowerCase().includes('sim') ||
           c.id === '0'
        );

        setAccounts(writableAccounts);
        
        // Auto-select the first likely Google account, or fallback
        const defaultAccount = writableAccounts.find(c => c.name.includes('gmail')) || writableAccounts[0];
        if (defaultAccount) setSelectedContainerId(defaultAccount.id);
      }
    } catch (e) {
      console.log("Error fetching accounts", e);
    }
  };

  const handleSave = async () => {
    if (!firstName) {
      Alert.alert("Missing Info", "Please enter at least a First Name.");
      return;
    }
    setLoading(true);

    try {
      const contact: Contacts.Contact = {
        contactType: Contacts.ContactTypes.Person,
        name: `${firstName} ${lastName}`.trim(), 
        [Contacts.Fields.FirstName]: firstName,
        [Contacts.Fields.LastName]: lastName,
        [Contacts.Fields.PhoneNumbers]: [{
          label: 'mobile',
          number: Array.isArray(number) ? number[0] : number,
          id: '1', 
          countryCode: 'IN'
        }],
      };

      if (email) {
        contact[Contacts.Fields.Emails] = [{ 
            email, 
            label: 'work', 
            id: '2' 
        }];
      }

      // Save to Device
      const result = await Contacts.addContactAsync(contact, selectedContainerId || undefined);

      if (result) {
        Alert.alert("Saved!", `Contact saved to your ${getSelectedAccountName()}.`, [
            { text: "OK", onPress: handleBack }
        ]);
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Could not save contact locally.");
    } finally {
      setLoading(false);
    }
  };

  const getSelectedAccountName = () => {
    const account = accounts.find(a => a.id === selectedContainerId);
    return account ? account.name : 'Device';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Contact</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.numberContainer}>
          <View style={styles.iconCircle}>
            <Feather name="phone" size={24} color="#007AFF" />
          </View>
          <View>
             <Text style={styles.label}>Mobile Number</Text>
             <Text style={styles.number}>{number}</Text>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>First Name</Text>
          <TextInput 
            style={styles.input} 
            placeholder="John" 
            value={firstName} 
            onChangeText={setFirstName} 
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>Last Name</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Doe" 
            value={lastName} 
            onChangeText={setLastName} 
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>Email (Optional)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="john@example.com" 
            keyboardType="email-address"
            value={email} 
            onChangeText={setEmail} 
          />
        </View>

        <Text style={styles.sectionTitle}>Save Location</Text>
        <View style={styles.accountList}>
          {accounts.length > 0 ? accounts.map((account) => (
            <TouchableOpacity 
              key={account.id} 
              style={[styles.accountOption, selectedContainerId === account.id && styles.activeAccount]}
              onPress={() => setSelectedContainerId(account.id)}
            >
              <View style={styles.radioCircle}>
                {selectedContainerId === account.id && <View style={styles.selectedDot} />}
              </View>
              <View>
                <Text style={styles.accountName}>
                   {account.name.includes('@') ? 'Google Account' : 'Device / SIM'}
                </Text>
                <Text style={styles.accountDetail}>{account.name}</Text>
              </View>
              {account.name.includes('@') && <Ionicons name="logo-google" size={18} color="#666" style={{marginLeft: 'auto'}} />}
            </TouchableOpacity>
          )) : (
            <Text style={styles.hint}>Loading accounts...</Text>
          )}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>SAVE TO DEVICE</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E5E7EB' },
  title: { fontSize: 20, fontWeight: '700' },
  content: { padding: 20 },
  numberContainer: { flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  iconCircle: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  number: { fontSize: 20, fontWeight: '700', color: '#111' },
  formGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#FFF', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', fontSize: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 10, color: '#111' },
  accountList: { marginBottom: 20 },
  accountOption: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  activeAccount: { borderColor: '#007AFF', backgroundColor: '#EFF6FF' },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#007AFF', alignItems: 'center', justifyContent: 'center' },
  selectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#007AFF' },
  accountName: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  accountDetail: { fontSize: 12, color: '#6B7280' },
  saveBtn: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  hint: { color: '#999', fontStyle: 'italic' }
});