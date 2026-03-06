import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, Platform, ActivityIndicator, Image, NativeModules, ToastAndroid, DeviceEventEmitter, Animated, Keyboard, KeyboardEvent } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { DefaultSmsModule } = NativeModules;

const normalizeNumber = (phone: string) => {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '');
  return clean.length >= 10 ? clean.slice(-10) : clean;
};

const ChatSkeleton = () => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
    ])).start();
  }, []);
  
  return (
    <View style={{ padding: 16, flex: 1, justifyContent: 'flex-end' }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.row, i % 2 === 0 ? styles.rowRight : styles.rowLeft]}>
          <Animated.View style={[styles.bubble, { backgroundColor: '#E2E8F0', width: Math.random() * 100 + 100, height: 40, opacity }]} />
        </View>
      ))}
    </View>
  );
};

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { senderId, senderName, isBank, avatar } = useLocalSearchParams();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState(''); 
  const [isSending, setIsSending] = useState(false);
  
  // 🚀 THE FIX: We will track the exact pixel height of the keyboard
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // 🚀 THE FIX: Listen directly to OS keyboard events to push the screen up
    const showListener = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideListener = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardDidShowListener = Keyboard.addListener(showListener, (e: KeyboardEvent) => {
        setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardDidHideListener = Keyboard.addListener(hideListener, () => {
        setKeyboardHeight(0);
    });

    loadChatThreadNatively();

    if (Platform.OS === 'android') DefaultSmsModule.startObservingSms();

    const smsListener = DeviceEventEmitter.addListener('onSMSReceived', () => loadChatThreadNatively());
    const syncListener = DeviceEventEmitter.addListener('onSyncComplete', () => loadChatThreadNatively());

    return () => { 
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
        smsListener.remove(); 
        syncListener.remove();
        if (Platform.OS === 'android') DefaultSmsModule.stopObservingSms();
    };
  }, [senderId]);

  const loadChatThreadNatively = async () => {
    try {
      if (messages.length === 0) setLoading(true); 
      const finalRawMsgs = await DefaultSmsModule.getMessagesByThread(senderId as string, 500);
      const finalDisplayArray = [];
      for (let i = 0; i < finalRawMsgs.length; i++) {
          finalDisplayArray.push(finalRawMsgs[i]);
          const currentDateStr = new Date(finalRawMsgs[i].date).toDateString();
          const nextMsg = i < finalRawMsgs.length - 1 ? finalRawMsgs[i + 1] : null;
          const nextDateStr = nextMsg ? new Date(nextMsg.date).toDateString() : null;
          if (currentDateStr !== nextDateStr) finalDisplayArray.push({ isDateHeader: true, date: finalRawMsgs[i].date, _id: `date-${finalRawMsgs[i].date}` });
      }
      setMessages(finalDisplayArray); 
    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText.trim();
    setInputText(''); 
    setIsSending(true);

    const tempMsg = { _id: `temp-${Date.now()}`, body: textToSend, date: Date.now(), type: 2, isPending: true };
    setMessages((prev) => {
      const latestMsgDate = prev.length > 0 && !prev[0].isDateHeader ? new Date(prev[0].date).toDateString() : null;
      const newMsgDate = new Date(tempMsg.date).toDateString();
      if (latestMsgDate !== newMsgDate) return [tempMsg, { isDateHeader: true, date: tempMsg.date, _id: `date-temp-${Date.now()}` }, ...prev];
      return [tempMsg, ...prev];
    });

    try {
      let finalNum = senderId as string;
      if (finalNum.length >= 10 && !finalNum.startsWith('+') && !finalNum.startsWith('0') && !finalNum.match(/[a-zA-Z]/)) {
          finalNum = `+91${normalizeNumber(finalNum)}`;
      }
      await DefaultSmsModule.sendDirectSMS(finalNum, textToSend);
    } catch (error) {
      ToastAndroid.show("Failed to send message", ToastAndroid.SHORT);
      setMessages((prev) => prev.filter(msg => msg._id !== tempMsg._id));
    } finally { setIsSending(false); }
  };

  const handleAttachment = () => {
      ToastAndroid.show("Multimedia (MMS) requires carrier APN configuration.", ToastAndroid.LONG);
  };

  const formatDateHeader = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderBubble = ({ item }: { item: any }) => {
    if (item.isDateHeader) return <View style={styles.dateHeaderContainer}><Text style={styles.dateHeaderText}>{formatDateHeader(item.date)}</Text></View>;
    const isMe = item.type === 2; 
    const time = new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft, item.isPending && { opacity: 0.6 }]}>
          <Text style={[styles.text, isMe ? styles.textRight : styles.textLeft]}>{item.body}</Text>
          <View style={styles.metaContainer}>
            <Text style={[styles.time, isMe ? styles.timeRight : styles.timeLeft]}>{time}</Text>
            {isMe && <Ionicons name={item.isPending ? "time-outline" : "checkmark-done"} size={14} color={item.isPending ? "rgba(0,0,0,0.4)" : "#6366F1"} style={{marginLeft: 4}} />}
          </View>
        </View>
      </View>
    );
  };

  const StickyHeader = () => {
    const displayName = senderName && senderName !== 'undefined' ? senderName : senderId;
    const isVerified = isBank === 'true';
    return (
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 10 : 0) }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#0F172A" /></TouchableOpacity>
          <View style={styles.profileSection}>
             <View style={styles.avatarContainer}>
                {avatar ? <Image source={{ uri: avatar as string }} style={styles.avatarImg} /> : <View style={[styles.avatarPlaceholder, isVerified ? styles.bankBg : styles.userBg]}>{isVerified ? <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" /> : <Text style={styles.avatarText}>{(displayName as string)?.[0]?.toUpperCase()}</Text>}</View>}
             </View>
             <View style={styles.textContainer}>
                <Text style={styles.headerName} numberOfLines={1}>{displayName} {isVerified && <MaterialCommunityIcons name="check-decagram" size={14} color="#3B82F6" style={{marginLeft: 4}} />}</Text>
                <Text style={styles.headerStatus} numberOfLines={1}>{isVerified ? 'Official Business' : senderId}</Text>
             </View>
          </View>
          <View style={styles.headerActions}>
             {!isVerified && <TouchableOpacity style={styles.actionIcon}><Ionicons name="call-outline" size={22} color="#6366F1" /></TouchableOpacity>}
             <TouchableOpacity style={styles.actionIcon}><Ionicons name="ellipsis-vertical" size={20} color="#64748B" /></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StickyHeader />
      
      {/* 🚀 THE FIX: We apply the dynamic keyboard height directly as paddingBottom to a standard View */}
      <View style={[styles.flex1, { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
        {loading ? <ChatSkeleton /> : (
          <FlatList 
            data={messages} 
            renderItem={renderBubble} 
            keyExtractor={(item) => item._id.toString()} 
            inverted 
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }} 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
          />
        )}
        {isBank !== 'true' && (
          <View style={[styles.inputWrapper, { paddingBottom: keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 10) }]}>
            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.attachBtn} onPress={handleAttachment}>
                  <Ionicons name="image-outline" size={24} color="#6366F1" />
              </TouchableOpacity>
              <TextInput style={styles.input} placeholder="Message" placeholderTextColor="#94A3B8" multiline value={inputText} onChangeText={setInputText} />
              <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && { backgroundColor: '#A5B4FC' }]} onPress={handleSendMessage} disabled={!inputText.trim() || isSending}>
                {isSending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={18} color="#FFF" />}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFEAE2' }, flex1: { flex: 1 }, headerContainer: { backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 12, paddingHorizontal: 10, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, zIndex: 100 }, headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, backBtn: { paddingRight: 10, paddingVertical: 5 }, profileSection: { flex: 1, flexDirection: 'row', alignItems: 'center' }, avatarContainer: { marginRight: 12 }, avatarImg: { width: 42, height: 42, borderRadius: 21 }, avatarPlaceholder: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' }, bankBg: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5' }, userBg: { backgroundColor: '#E0E7FF', borderWidth: 1, borderColor: '#C7D2FE' }, avatarText: { fontSize: 18, fontWeight: '700', color: '#4338CA' }, textContainer: { justifyContent: 'center', flex: 1 }, headerName: { fontSize: 16, fontWeight: '700', color: '#0F172A' }, headerStatus: { fontSize: 11, color: '#64748B', marginTop: 1 }, headerActions: { flexDirection: 'row', alignItems: 'center' }, actionIcon: { padding: 8, marginLeft: 5 }, row: { marginBottom: 10, width: '100%' }, rowRight: { alignItems: 'flex-end' }, rowLeft: { alignItems: 'flex-start' }, bubble: { maxWidth: '80%', padding: 10, paddingHorizontal: 14, borderRadius: 16, elevation: 1 }, bubbleRight: { backgroundColor: '#E0E7FF', borderBottomRightRadius: 2 }, bubbleLeft: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 2 }, text: { fontSize: 15, lineHeight: 22, color: '#1E293B' }, textRight: { color: '#1E293B' }, textLeft: { color: '#1E293B' }, metaContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 }, time: { fontSize: 10 }, timeRight: { color: 'rgba(0,0,0,0.4)' }, timeLeft: { color: '#94A3B8' }, dateHeaderContainer: { alignItems: 'center', marginVertical: 12 }, dateHeaderText: { backgroundColor: '#D1D5DB', color: '#334155', fontSize: 12, fontWeight: '600', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, overflow: 'hidden' }, inputWrapper: { backgroundColor: '#EFEAE2' }, inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#fff', marginHorizontal: 10, borderRadius: 30, elevation: 2 }, attachBtn: { padding: 8, marginRight: 4 }, input: { flex: 1, maxHeight: 100, fontSize: 16, paddingHorizontal: 10 }, sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' }
});