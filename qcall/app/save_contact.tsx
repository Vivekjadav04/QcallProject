import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Image, NativeModules, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const { CallManagerModule } = NativeModules;

const THEME = {
  bg: '#F8FAFC',
  primary: '#0F172A',
  accent: '#2563EB',
  white: '#FFFFFF',
  border: '#E2E8F0',
  textMain: '#1E293B',
  textSub: '#64748B',
  danger: '#EF4444'
};

export default function SaveContactScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const isEditing = !!params.editContactId;

  // Form States
  const [firstName, setFirstName] = useState((params.name as string) || '');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState((params.phone as string) || '');
  const [email, setEmail] = useState('');
  
  // Image States
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Account States
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(isEditing);

  useEffect(() => {
    if (isEditing) {
      loadExistingContact();
    } else {
      loadAccounts();
    }
  }, [params.editContactId]);

  const loadAccounts = async () => {
    try {
      const results = await CallManagerModule.getAccountStatistics();
      setAccounts(results);
      if (results.length > 0) {
        const defaultAcc = results.find((a: any) => a.type === 'com.google') || results[0];
        setSelectedAccount(defaultAcc);
      }
    } catch (e) {
      console.error("Account load failed", e);
    }
  };

  const loadExistingContact = async () => {
    try {
      const contact = await Contacts.getContactByIdAsync(params.editContactId as string, [
        Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Name, Contacts.Fields.Image
      ]);
      
      if (contact) {
        setFirstName(contact.firstName || contact.name?.split(' ')[0] || '');
        setLastName(contact.lastName || contact.name?.split(' ').slice(1).join(' ') || '');
        setPhone(contact.phoneNumbers?.[0]?.number || '');
        setEmail(contact.emails?.[0]?.email || '');
        if (contact.imageAvailable && contact.image?.uri) {
          setImageUri(contact.image.uri);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingData(false);
    }
  };

  // 🟢 CUSTOM IMAGE PICKER LOGIC
  const pickImage = async (mode: 'camera' | 'gallery') => {
    setShowImageModal(false);
    Haptics.selectionAsync();

    try {
      let result;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Perfect square for avatars
        quality: 0.5, // Compress to save memory
        base64: true, // Need base64 to send to Kotlin native DB
      };

      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Denied", "Camera access is required to take photos.");
            return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Denied", "Gallery access is required to choose photos.");
            return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setImageBase64(result.assets[0].base64 || null);
      }
    } catch (error) {
      Alert.alert("Error", "Could not process the image.");
    }
  };

  const removeImage = () => {
    setShowImageModal(false);
    setImageUri(null);
    setImageBase64(null);
    Haptics.selectionAsync();
  };

  // 🟢 SAVE / UPDATE LOGIC
  const handleSave = async () => {
    if (!firstName.trim() && !phone.trim()) {
      Alert.alert("Missing Info", "Please enter at least a name or phone number.");
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        // Update Existing Contact via Kotlin
        await CallManagerModule.updateContactNative(
            params.editContactId as string, 
            firstName, 
            lastName, 
            phone, 
            imageBase64 || "" // Pass the new photo base64
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } else {
        // Create New Contact via Kotlin
        await CallManagerModule.saveContactToAccount(
          firstName, 
          lastName, 
          phone, 
          email,
          selectedAccount?.name, 
          selectedAccount?.type, 
          imageBase64
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)/contacts'); 
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save contact");
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Contact' : 'New Contact'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={THEME.accent} /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Profile Image Section */}
          <View style={styles.imageSection}>
            <TouchableOpacity style={styles.imageCircle} onPress={() => setShowImageModal(true)} activeOpacity={0.8}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.fullImage} />
              ) : (
                <View style={styles.placeholderIcon}>
                  <Text style={styles.avatarInitials}>
                    {firstName ? firstName.charAt(0).toUpperCase() : <Feather name="user" size={40} color="#94A3B8" />}
                  </Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Feather name="camera" size={16} color="#FFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.addPhotoText}>{imageUri ? 'Change Photo' : 'Add Photo'}</Text>
          </View>

          {/* Account Selector (Only show when creating new) */}
          {!isEditing && (
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
          )}

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
      </KeyboardAvoidingView>

      {/* 🟢 CUSTOM IMAGE PICKER BOTTOM SHEET */}
      <Modal visible={showImageModal} transparent animationType="fade" onRequestClose={() => setShowImageModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowImageModal(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Profile Photo</Text>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => pickImage('camera')}>
              <View style={[styles.modalIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Feather name="camera" size={22} color={THEME.accent} />
              </View>
              <Text style={styles.modalOptionText}>Take a Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={() => pickImage('gallery')}>
              <View style={[styles.modalIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Feather name="image" size={22} color="#16A34A" />
              </View>
              <Text style={styles.modalOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>

            {imageUri && (
              <TouchableOpacity style={styles.modalOption} onPress={removeImage}>
                <View style={[styles.modalIconBox, { backgroundColor: '#FEF2F2' }]}>
                  <Feather name="trash-2" size={22} color={THEME.danger} />
                </View>
                <Text style={[styles.modalOptionText, { color: THEME.danger }]}>Remove Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

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
  cancelText: { fontSize: 16, color: THEME.textSub, fontWeight: '500' },
  saveBtnText: { color: THEME.accent, fontSize: 16, fontWeight: '800' },
  scrollContent: { paddingBottom: 40 },
  
  // AVATAR
  imageSection: { alignItems: 'center', marginVertical: 30 },
  imageCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  fullImage: { width: '100%', height: '100%' },
  placeholderIcon: { alignItems: 'center' },
  avatarInitials: { fontSize: 40, fontWeight: '700', color: '#64748B' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: THEME.primary, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  addPhotoText: { marginTop: 12, color: THEME.accent, fontWeight: '600', fontSize: 14 },

  section: { paddingHorizontal: 20, marginBottom: 25 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: THEME.textSub, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  accountBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: THEME.border },
  accountInfo: { flex: 1, marginLeft: 12 },
  accountName: { fontSize: 15, fontWeight: '600', color: THEME.textMain },
  inputGroup: { paddingHorizontal: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: THEME.border, marginBottom: 15, paddingBottom: 5 },
  fieldIcon: { marginRight: 15 },
  input: { flex: 1, fontSize: 16, color: THEME.textMain, paddingVertical: 10 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  
  // IMAGE MODAL
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 10 },
  modalHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: THEME.primary, marginBottom: 20 },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  modalOptionText: { fontSize: 16, color: THEME.textMain, fontWeight: '600' },

  // ACCOUNT MODAL
  sheetContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: THEME.textSub, marginBottom: 20 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sheetRowName: { fontSize: 16, fontWeight: '600', color: THEME.textMain },
  sheetRowType: { fontSize: 12, color: THEME.textSub, marginTop: 2 }
});