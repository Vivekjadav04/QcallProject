import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, NativeModules, ToastAndroid, ActivityIndicator, FlatList, Keyboard, KeyboardEvent } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';

const { DefaultSmsModule } = NativeModules;

const getCore10Digits = (phone: string) => {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  return clean.length >= 10 ? clean.slice(-10) : clean;
};

export default function ComposeMessageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [recipient, setRecipient] = useState('');
  const [displayRecipient, setDisplayRecipient] = useState(''); 
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 🚀 THE FIX: State to hold the exact pixel height of the Android keyboard
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => { 
    // 🚀 THE FIX: Listen directly to OS keyboard events
    const showListener = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideListener = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardDidShowListener = Keyboard.addListener(showListener, (e: KeyboardEvent) => {
        setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardDidHideListener = Keyboard.addListener(hideListener, () => {
        setKeyboardHeight(0);
    });

    loadContacts(); 

    return () => { 
        keyboardDidShowListener.remove(); 
        keyboardDidHideListener.remove(); 
    };
  }, []);

  const loadContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
      const flatContacts: any[] = [];
      data.forEach(c => {
        if (c.phoneNumbers && c.name) {
          c.phoneNumbers.forEach(p => {
            if (p.number) {
              flatContacts.push({ id: p.id || Math.random().toString(), name: c.name, number: p.number, cleanNumber: getCore10Digits(p.number) });
            }
          });
        }
      });
      flatContacts.sort((a, b) => a.name.localeCompare(b.name));
      setAllContacts(flatContacts);
    }
  };

  const handleRecipientSearch = (text: string) => {
    setDisplayRecipient(text);
    setRecipient(text); 
    if (text.trim().length > 0) {
      setIsSearching(true);
      const searchTerm = text.toLowerCase().trim();
      const filtered = allContacts.filter(c => c.name.toLowerCase().includes(searchTerm) || (c.cleanNumber.includes(searchTerm.replace(/\D/g, '')) && searchTerm.replace(/\D/g, '').length > 0)).slice(0, 8); 
      setFilteredContacts(filtered);
    } else {
      setIsSearching(false);
      setFilteredContacts([]);
    }
  };

  const selectContact = (contact: any) => {
    setDisplayRecipient(contact.name);
    setRecipient(contact.number);
    setIsSearching(false);
    Keyboard.dismiss(); 
  };

  const handleSend = async () => {
    let sendNumber = recipient.replace(/\D/g, ''); 
    if (!sendNumber || !message.trim()) return;
    if (sendNumber.length === 10) sendNumber = `+91${sendNumber}`; 

    const coreNumber = getCore10Digits(sendNumber);
    setIsSending(true);
    try {
      await DefaultSmsModule.sendDirectSMS(sendNumber, message.trim());
      ToastAndroid.show("Message sent", ToastAndroid.SHORT);
      router.replace({ pathname: '/messages/chat', params: { senderId: coreNumber, senderName: displayRecipient !== recipient ? displayRecipient : coreNumber, isBank: 'false' } });
    } catch (error) {
      ToastAndroid.show("Failed to send message", ToastAndroid.LONG);
      setIsSending(false);
    }
  };

  const handleAttachment = () => {
      ToastAndroid.show("Multimedia (MMS) requires carrier APN configuration.", ToastAndroid.LONG);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#0F172A" /></TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 🚀 THE FIX: Standard View that dynamically adjusts its paddingBottom based on the keyboard pixels */}
      <View style={[styles.flex1, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
        <View style={styles.toContainer}>
          <Text style={styles.toLabel}>To:</Text>
          <TextInput style={styles.toInput} placeholder="Type a name or phone number" placeholderTextColor="#94A3B8" value={displayRecipient} onChangeText={handleRecipientSearch} onFocus={() => { if(displayRecipient) setIsSearching(true); }} autoFocus />
        </View>
        {isSearching && filteredContacts.length > 0 && (
          <View style={styles.dropdown}>
            <FlatList data={filteredContacts} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" renderItem={({ item }) => (
                <TouchableOpacity style={styles.dropdownItem} onPress={() => selectContact(item)}>
                  <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}><Text style={styles.contactName} numberOfLines={1}>{item.name}</Text><Text style={styles.contactNumber}>{item.number}</Text></View>
                </TouchableOpacity>
              )} />
          </View>
        )}
        <View style={styles.messageArea}>
          <View style={[styles.inputContainer, { marginBottom: keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 10) }]}>
            <TouchableOpacity style={styles.attachBtn} onPress={handleAttachment}>
                <Ionicons name="image-outline" size={24} color="#6366F1" />
            </TouchableOpacity>
            <TextInput style={styles.input} placeholder="Message" placeholderTextColor="#94A3B8" multiline value={message} onChangeText={setMessage} onFocus={() => setIsSearching(false)} />
            <TouchableOpacity style={[styles.sendBtn, (!recipient.trim() || !message.trim()) && { backgroundColor: '#A5B4FC' }]} onPress={handleSend} disabled={!recipient.trim() || !message.trim() || isSending}>
              {isSending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={18} color="#FFF" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' }, flex1: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', zIndex: 10 }, backBtn: { padding: 4 }, headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' }, toContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', zIndex: 5 }, toLabel: { fontSize: 16, color: '#64748B', fontWeight: '500', marginRight: 10 }, toInput: { flex: 1, fontSize: 16, color: '#0F172A', padding: 0 }, dropdown: { position: 'absolute', top: 60, left: 0, right: 0, backgroundColor: '#FFF', maxHeight: 300, zIndex: 20, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }, dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }, avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center', marginRight: 14 }, avatarText: { fontSize: 18, fontWeight: '700', color: '#4338CA' }, contactName: { fontSize: 16, fontWeight: '600', color: '#1E293B' }, contactNumber: { fontSize: 13, color: '#64748B', marginTop: 2 }, messageArea: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#EFEAE2', zIndex: 1 }, inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#fff', marginHorizontal: 10, borderRadius: 30, elevation: 2 }, attachBtn: { padding: 8, marginRight: 4 }, input: { flex: 1, maxHeight: 120, fontSize: 16, paddingHorizontal: 10 }, sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' }
});