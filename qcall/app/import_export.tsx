import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Modal, ActivityIndicator, Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as Contacts from 'expo-contacts';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export default function ImportExportScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedFileUri, setSavedFileUri] = useState('');
  const [contactCount, setContactCount] = useState(0);

  // 🟢 HELPER: GENERATE THE VCF STRING
  const generateVCFData = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your contacts.');
      return null;
    }

    const { data } = await Contacts.getContactsAsync();
    if (data.length === 0) {
      Alert.alert('No Contacts', 'You have no contacts to export.');
      return null;
    }

    let vcfString = '';
    data.forEach(contact => {
      vcfString += 'BEGIN:VCARD\nVERSION:3.0\n';
      vcfString += `FN:${contact.name || 'Unknown'}\n`;
      if (contact.phoneNumbers) {
        contact.phoneNumbers.forEach(phone => {
          vcfString += `TEL;TYPE=${phone.label || 'CELL'}:${phone.number}\n`;
        });
      }
      vcfString += 'END:VCARD\n';
    });

    return { vcfString, count: data.length };
  };

  // 🟢 OPTION 1: USER SELECTS EXACT FOLDER PATH TO SAVE (ANDROID NATIVE)
  const exportToSpecificFolder = async () => {
    try {
      setIsProcessing(true);
      const result = await generateVCFData();
      if (!result) {
        setIsProcessing(false);
        return;
      }

      if (Platform.OS === 'android') {
        // Opens the native file manager to pick a folder
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        
        if (permissions.granted) {
          // Creates contacts.vcf in the folder the user just selected
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            'contacts.vcf',
            'text/x-vcard'
          );

          await FileSystem.writeAsStringAsync(fileUri, result.vcfString, { encoding: 'utf8' });
          setIsProcessing(false);
          Alert.alert('Success!', `contacts.vcf successfully saved to your selected folder.`);
        } else {
          setIsProcessing(false);
          // User cancelled the folder selection
        }
      } else {
        // iOS Fallback (iOS requires Share sheet to save to "Files")
        const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
        const fileUri = `${dir}contacts.vcf`;
        await FileSystem.writeAsStringAsync(fileUri, result.vcfString, { encoding: 'utf8' });
        setIsProcessing(false);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/vcard', dialogTitle: 'Save Contacts' });
        }
      }
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      Alert.alert('Error', 'Failed to save the file.');
    }
  };

  // 🟢 OPTION 2: QUICK INTERNAL SAVE & SHOW POPUP (THE PREVIOUS WAY)
  const exportAndShare = async () => {
    try {
      setIsProcessing(true);
      const result = await generateVCFData();
      if (!result) {
        setIsProcessing(false);
        return;
      }

      // Save silently internally
      const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const fileUri = `${dir}Qcall_Quick_Backup.vcf`;
      
      await FileSystem.writeAsStringAsync(fileUri, result.vcfString, { encoding: 'utf8' });

      setSavedFileUri(fileUri);
      setContactCount(result.count);
      setIsProcessing(false);
      setModalVisible(true); // Open the custom popup

    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      Alert.alert('Error', 'Failed to generate the backup file.');
    }
  };

  // 🟢 SHARE FROM THE POPUP
  const handleShare = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(savedFileUri, { 
            mimeType: 'text/vcard', 
            dialogTitle: 'Share Qcall Contacts' 
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  // 🟢 IMPORT CONTACTS FROM .VCF
  const importContacts = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/vcard', 'text/x-vcard', '*/*'], 
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return; 

      const fileUri = result.assets[0].uri;
      const vcfData = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' });
      
      const contactBlocks = vcfData.split('END:VCARD');
      const totalContacts = contactBlocks.length - 1; 

      if (totalContacts > 0) {
        Alert.alert('Success', `Found ${totalContacts} contacts. Ready to process!`);
      } else {
        Alert.alert('Empty File', 'Could not find any valid contacts.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to read the contact file.');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Import & Export Contacts' }} />
      
      <View style={styles.header}>
        <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="card-account-phone-outline" size={50} color="#4C1D95" />
        </View>
        <Text style={styles.title}>Contact Backup</Text>
        <Text style={styles.subtitle}>Choose how you want to backup your contacts or restore from an existing file.</Text>
      </View>
      
      {/* BUTTON 1: NATIVE FOLDER SELECTION */}
      <TouchableOpacity style={styles.btn} onPress={exportToSpecificFolder} disabled={isProcessing}>
        {isProcessing ? (
            <ActivityIndicator color="#FFF" />
        ) : (
            <>
                <Feather name="folder" size={22} color="#FFF" />
                <Text style={styles.btnText}>Save to Specific Folder</Text>
            </>
        )}
      </TouchableOpacity>

      {/* BUTTON 2: QUICK SHARE POPUP */}
      <TouchableOpacity style={[styles.btn, styles.shareBtn]} onPress={exportAndShare} disabled={isProcessing}>
        {isProcessing ? (
            <ActivityIndicator color="#FFF" />
        ) : (
            <>
                <Feather name="share" size={22} color="#FFF" />
                <Text style={styles.btnText}>Quick Export & Share</Text>
            </>
        )}
      </TouchableOpacity>

      {/* BUTTON 3: IMPORT */}
      <TouchableOpacity style={[styles.btn, styles.importBtn]} onPress={importContacts} disabled={isProcessing}>
        <Feather name="upload" size={22} color="#FFF" />
        <Text style={styles.btnText}>Restore from Device</Text>
      </TouchableOpacity>

      {/* 🟢 BEAUTIFUL CUSTOM POPUP (MODAL) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.successBadge}>
                <Ionicons name="checkmark-done" size={40} color="#10B981" />
            </View>

            <Text style={styles.modalTitle}>Backup Ready!</Text>
            <Text style={styles.modalMessage}>
              <Text style={{fontWeight: 'bold', color: '#1E293B'}}>{contactCount}</Text> contacts have been packaged and are ready to send.
            </Text>

            <TouchableOpacity style={styles.modalShareBtn} onPress={handleShare}>
              <MaterialCommunityIcons name="share-variant" size={20} color="#FFF" />
              <Text style={styles.modalShareText}>Share File</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 25 },
  header: { alignItems: 'center', marginBottom: 40 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22, paddingHorizontal: 15 },
  
  btn: { flexDirection: 'row', backgroundColor: '#4C1D95', paddingVertical: 16, paddingHorizontal: 30, borderRadius: 16, alignItems: 'center', width: '100%', justifyContent: 'center', marginBottom: 15, shadowColor: '#4C1D95', shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  shareBtn: { backgroundColor: '#3B82F6', shadowColor: '#3B82F6' },
  importBtn: { backgroundColor: '#10B981', shadowColor: '#10B981', marginTop: 10 },
  btnText: { color: '#FFF', fontSize: 17, fontWeight: '700', marginLeft: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 24, padding: 30, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  successBadge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 4, borderColor: '#FFF', marginTop: -60, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
  modalMessage: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  
  modalShareBtn: { flexDirection: 'row', backgroundColor: '#4C1D95', width: '100%', paddingVertical: 15, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modalShareText: { color: '#FFF', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  
  modalCloseBtn: { width: '100%', paddingVertical: 15, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  modalCloseText: { color: '#475569', fontSize: 16, fontWeight: '700' },
});