import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  TextInput, ScrollView, KeyboardAvoidingView, Platform, Modal 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useSecureOps } from '../../context/SecureOperationsContext';

// 🟢 THEME Colors for the Modal
const THEME = {
  primary: '#3B82F6',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  text: '#0F172A',
  subText: '#64748B',
};

const SPAM_CATEGORIES = [
  { id: 'Scam', label: 'Scam', icon: 'shield-off' },
  { id: 'Spam', label: 'Spam', icon: 'alert-triangle' },
  { id: 'Bank Fraud', label: 'Bank Fraud', icon: 'dollar-sign' },
  { id: 'Harassment', label: 'Harassment', icon: 'user-x' },
  { id: 'Telemarketer', label: 'Telemarketer', icon: 'headphones' },
  { id: 'Custom', label: 'Other / Custom', icon: 'edit-2' },
];

export default function SpamReportScreen() {
  const router = useRouter();
  const { number } = useLocalSearchParams();
  const { reportSpam } = useSecureOps();

  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Spam');
  const [customCategory, setCustomCategory] = useState('');
  const [comment, setComment] = useState('');
  const [location, setLocation] = useState('');

  // 🟢 CUSTOM POPUP STATE
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupConfig, setPopupConfig] = useState({ 
    type: 'info', 
    title: '', 
    message: '',
    onConfirm: () => {} 
  });

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // 🟢 BEAUTIFUL POPUP TRIGGER
  const showCustomPopup = (type: 'success' | 'error' | 'info', title: string, message: string, onConfirmAction = () => setPopupVisible(false)) => {
    setPopupConfig({ type, title, message, onConfirm: onConfirmAction });
    setPopupVisible(true);
  };

  const handleSubmit = async () => {
    if (!number) return;
    
    if (selectedCategory === 'Custom' && customCategory.trim() === '') {
      showCustomPopup('error', 'Missing Category', 'Please type a custom reason for reporting this number.');
      return;
    }

    setLoading(true);

    const cleanNumber = Array.isArray(number) ? number[0] : number;
    const finalCategory = selectedCategory === 'Custom' ? customCategory.trim() : selectedCategory;

    // 🟢 Capture result from updated Context
    const result = await reportSpam(cleanNumber, finalCategory, comment, location);

    setLoading(false);

    if (result.success) {
      showCustomPopup('success', 'Thank You!', result.message, () => {
        setPopupVisible(false);
        handleBack(); 
      });
    } else {
      // 🟢 CHECK: If backend message contains "already", show the blue "Info" theme
      if (result.message.toLowerCase().includes('already')) {
        showCustomPopup(
          'info', 
          'Note', 
          'You have already reported this number. We have recorded your feedback!',
          () => { 
            setPopupVisible(false); 
            handleBack(); // Send them back since their report is already in the system
          }
        );
      } else {
        // Show actual Red Error for other failures (Network, 500, etc)
        showCustomPopup('error', 'Report Failed', result.message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} disabled={loading} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Report Spam</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={styles.callerCard}>
            <View style={styles.iconCircle}>
               <Feather name="alert-triangle" size={32} color="#EF4444" />
            </View>
            <Text style={styles.numberText}>{number}</Text>
            <Text style={styles.subtitle}>Help the community by identifying this caller.</Text>
          </View>

          <Text style={styles.sectionLabel}>Select Category</Text>
          <View style={styles.chipContainer}>
            {SPAM_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Feather 
                    name={cat.icon as any} 
                    size={16} 
                    color={isActive ? '#DC2626' : '#6B7280'} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedCategory === 'Custom' && (
            <View style={[styles.inputContainer, styles.customCategoryInput]}>
              <Feather name="edit-2" size={20} color="#DC2626" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Type your own category..."
                placeholderTextColor="#9CA3AF"
                value={customCategory}
                onChangeText={setCustomCategory}
                autoFocus={true}
              />
            </View>
          )}

          <Text style={styles.sectionLabel}>Additional Details (Optional)</Text>
          
          <View style={styles.inputContainer}>
            <Feather name="map-pin" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Location (e.g. City, State)"
              placeholderTextColor="#9CA3AF"
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={[styles.inputContainer, { alignItems: 'flex-start' }]}>
            <Feather name="message-square" size={20} color="#9CA3AF" style={[styles.inputIcon, { marginTop: 14 }]} />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What did they say? (e.g. Claimed to be bank)"
              placeholderTextColor="#9CA3AF"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Feather name="shield" size={20} color="#FFF" style={{ marginRight: 10 }} />
                <Text style={styles.submitBtnText}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      {/* 🟢 BEAUTIFUL CUSTOM MODAL */}
      <Modal transparent visible={popupVisible} animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                
                <View style={[styles.modalIconBox, { backgroundColor: popupConfig.type === 'error' ? '#FEE2E2' : popupConfig.type === 'success' ? '#D1FAE5' : '#DBEAFE' }]}>
                    <Feather 
                        name={popupConfig.type === 'error' ? 'alert-circle' : popupConfig.type === 'success' ? 'check-circle' : 'info'} 
                        size={32} 
                        color={popupConfig.type === 'error' ? THEME.danger : popupConfig.type === 'success' ? THEME.success : THEME.primary} 
                    />
                </View>

                <Text style={styles.modalTitle}>{popupConfig.title}</Text>
                <Text style={styles.modalMessage}>{popupConfig.message}</Text>

                <View style={styles.modalActionRow}>
                    <TouchableOpacity 
                      style={[styles.modalBtnConfirm, { backgroundColor: popupConfig.type === 'error' ? THEME.danger : popupConfig.type === 'success' ? THEME.success : THEME.primary }]} 
                      onPress={popupConfig.onConfirm}
                    >
                        <Text style={styles.modalBtnConfirmText}>Got it</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  callerCard: { alignItems: 'center', backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  numberText: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: '#DC2626' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16, overflow: 'hidden' },
  customCategoryInput: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  inputIcon: { paddingLeft: 16, paddingRight: 10 },
  input: { flex: 1, paddingVertical: 16, paddingRight: 16, fontSize: 15, color: '#111827' },
  textArea: { height: 100 },
  footer: { padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  submitBtn: { flexDirection: 'row', backgroundColor: '#EF4444', padding: 18, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  modalIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: THEME.text, marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 15, color: THEME.subText, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalActionRow: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtnConfirm: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnConfirmText: { color: '#FFF', fontWeight: '700', fontSize: 15 }
});