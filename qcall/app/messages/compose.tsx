import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Platform,
  KeyboardAvoidingView, ScrollView, ActivityIndicator, ToastAndroid,
  PermissionsAndroid, Keyboard, Animated, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// @ts-ignore
import SmsAndroid from 'react-native-get-sms-android';

const THEME = {
  colors: {
    bg: '#FFFFFF',
    primary: '#0F172A',
    textMain: '#1E293B',
    textSub: '#94A3B8',
    inputBg: '#F8FAFC',
    border: '#E2E8F0'
  }
};

const QUICK_REPLIES = ["Hey there! 👋", "Can I call you?", "I'm busy right now.", "Call me later.", "What's up?"];

export default function ComposeMessageScreen() {
  const router = useRouter();
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [inputHeight, setInputHeight] = useState(50);
  const sendScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(sendScale, {
      toValue: (message.length > 0 && recipient.length > 0) ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [message, recipient]);

  const handleSend = async () => {
    if (!recipient || !message) return;
    setIsSending(true);
    Keyboard.dismiss();

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS);
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          SmsAndroid.autoSend(
            recipient,
            message,
            (fail: string) => { setIsSending(false); ToastAndroid.show("Failed", ToastAndroid.SHORT); },
            (success: string) => { setIsSending(false); ToastAndroid.show("Sent!", ToastAndroid.SHORT); router.back(); }
          );
        } else {
          setIsSending(false);
        }
      } catch (err) { setIsSending(false); }
    } else {
      setIsSending(false);
      alert("Not supported on Simulator");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Feather name="x" size={24} color={THEME.colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={{ width: 24 }} /> 
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Recipient */}
          <View style={styles.recipientRow}>
            <Text style={styles.labelTo}>To:</Text>
            <TextInput
              style={styles.recipientInput}
              placeholder="Name or number"
              placeholderTextColor={THEME.colors.textSub}
              value={recipient}
              onChangeText={setRecipient}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity><Ionicons name="add-circle" size={28} color="#3B82F6" /></TouchableOpacity>
          </View>
          <View style={styles.divider} />

          {/* Quick Chips */}
          <View style={styles.chipsContainer}>
            <Text style={styles.suggestionTitle}>Quick Suggestions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {QUICK_REPLIES.map((text, index) => (
                <TouchableOpacity key={index} style={styles.chip} onPress={() => setMessage(prev => prev + (prev ? " " : "") + text)}>
                  <Text style={styles.chipText}>{text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Footer Input */}
        <View style={styles.footer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.msgInput, { height: Math.max(50, inputHeight) }]}
              placeholder="Text message"
              placeholderTextColor={THEME.colors.textSub}
              multiline
              value={message}
              onChangeText={setMessage}
              onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
            />
          </View>
          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={isSending}>
              {isSending ? <ActivityIndicator color="#FFF" size="small"/> : <Ionicons name="arrow-up" size={24} color="#FFF" />}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: THEME.colors.primary },
  closeBtn: { padding: 5, backgroundColor: '#F8FAFC', borderRadius: 20 },
  scrollContent: { padding: 20 },
  recipientRow: { flexDirection: 'row', alignItems: 'center' },
  labelTo: { fontSize: 16, color: THEME.colors.textSub, fontWeight: '600', marginRight: 10 },
  recipientInput: { flex: 1, fontSize: 16, color: THEME.colors.textMain, fontWeight: '500', paddingVertical: 10 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 20 },
  chipsContainer: { marginBottom: 30 },
  suggestionTitle: { fontSize: 12, fontWeight: '700', color: THEME.colors.textSub, textTransform: 'uppercase' },
  chip: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  chipText: { fontSize: 14, color: THEME.colors.textMain, fontWeight: '500' },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  inputWrapper: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 15, paddingVertical: 2 },
  msgInput: { fontSize: 16, color: THEME.colors.textMain, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: THEME.colors.primary, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 }
});