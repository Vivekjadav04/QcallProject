import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Image 
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import SmsAndroid from 'react-native-get-sms-android';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { senderId, senderName, isBank, avatar } = useLocalSearchParams();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChatThread();
  }, [senderId]);

  const loadChatThread = () => {
    const filter = { 
      box: '', 
      address: senderId as string, 
      maxCount: 100 
    };

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: string) => { console.log('Error:', fail); setLoading(false); },
      (count: number, smsList: string) => {
        try {
          const raw = JSON.parse(smsList);
          
          // 🟢 INJECT DATE HEADERS LOGIC
          const processedMessages = [];
          
          // Raw messages from Android are usually newest first (descending).
          // We loop from the oldest to newest (end of array to start) to detect date changes.
          for (let i = raw.length - 1; i >= 0; i--) {
            const currentMsg = raw[i];
            const previousMsg = i < raw.length - 1 ? raw[i + 1] : null;

            // Check if date changed
            const currentDateStr = new Date(currentMsg.date).toDateString();
            const previousDateStr = previousMsg ? new Date(previousMsg.date).toDateString() : null;

            if (currentDateStr !== previousDateStr) {
               // Inject a special object representing the date divider
               processedMessages.unshift({ 
                 isDateHeader: true, 
                 date: currentMsg.date,
                 _id: `date-${currentMsg.date}`
               });
            }
            // Add the actual message
            processedMessages.unshift(currentMsg);
          }

          setMessages(processedMessages); 
        } catch (e) { console.log(e); } 
        finally { setLoading(false); }
      }
    );
  };

  // 🟢 Helper to format the Date text (Today, Yesterday, or Date)
  const formatDateHeader = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const renderBubble = ({ item }: { item: any }) => {
    // 🟢 RENDER DATE HEADER
    if (item.isDateHeader) {
      return (
        <View style={styles.dateHeaderContainer}>
          <Text style={styles.dateHeaderText}>{formatDateHeader(item.date)}</Text>
        </View>
      );
    }

    // 🟢 RENDER NORMAL MESSAGE
    const isMe = item.type === 2; 
    const time = new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
          <Text style={[styles.text, isMe ? styles.textRight : styles.textLeft]}>{item.body}</Text>
          <View style={styles.metaContainer}>
            <Text style={[styles.time, isMe ? styles.timeRight : styles.timeLeft]}>{time}</Text>
            {isMe && <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" style={{marginLeft: 4}} />}
          </View>
        </View>
      </View>
    );
  };

  const StickyHeader = () => {
    const displayName = senderName && senderName !== 'undefined' ? senderName : senderId;
    const isVerified = isBank === 'true';

    return (
      <View style={[
        styles.headerContainer, 
        { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 10 : 0) } 
      ]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.profileSection}>
             <View style={styles.avatarContainer}>
                {avatar ? (
                   <Image source={{ uri: avatar as string }} style={styles.avatarImg} />
                ) : (
                   <View style={[styles.avatarPlaceholder, isVerified ? styles.bankBg : styles.userBg]}>
                      {isVerified ? (
                         <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" />
                      ) : (
                         <Text style={styles.avatarText}>{(displayName as string)?.[0]?.toUpperCase()}</Text>
                      )}
                   </View>
                )}
             </View>
             
             <View style={styles.textContainer}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {displayName}
                  {isVerified && <MaterialCommunityIcons name="check-decagram" size={14} color="#3B82F6" style={{marginLeft: 4}} />}
                </Text>
                <Text style={styles.headerStatus} numberOfLines={1}>
                   {isVerified ? 'Official Business' : senderId}
                </Text>
             </View>
          </View>

          <View style={styles.headerActions}>
             {!isVerified && (
                <TouchableOpacity style={styles.actionIcon}><Ionicons name="call-outline" size={22} color="#6366F1" /></TouchableOpacity>
             )}
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

      <KeyboardAvoidingView 
        style={styles.flex1} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={messages}
            renderItem={renderBubble}
            keyExtractor={(item) => item._id.toString()}
            inverted 
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {isBank !== 'true' && (
          <View style={[
            styles.inputWrapper, 
            { paddingBottom: Math.max(insets.bottom, 10) }
          ]}>
            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.attachBtn}>
                <Ionicons name="add" size={28} color="#6366F1" />
              </TouchableOpacity>
              <TextInput 
                style={styles.input} 
                placeholder="Message" 
                placeholderTextColor="#94A3B8"
                multiline
              />
              <TouchableOpacity style={styles.sendBtn}>
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFEAE2' },
  flex1: { flex: 1 },
  
  // --- HEADER ---
  headerContainer: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    paddingHorizontal: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { paddingRight: 10, paddingVertical: 5 },
  profileSection: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { marginRight: 12 },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  avatarPlaceholder: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  bankBg: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5' },
  userBg: { backgroundColor: '#E0E7FF', borderWidth: 1, borderColor: '#C7D2FE' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#4338CA' },
  
  textContainer: { justifyContent: 'center', flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  headerStatus: { fontSize: 11, color: '#64748B', marginTop: 1 },
  
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionIcon: { padding: 8, marginLeft: 5 },

  // --- BUBBLES ---
  row: { marginBottom: 10, width: '100%' },
  rowRight: { alignItems: 'flex-end' },
  rowLeft: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 10, paddingHorizontal: 14, borderRadius: 16, elevation: 1 },
  bubbleRight: { backgroundColor: '#E0E7FF', borderBottomRightRadius: 2 }, 
  bubbleLeft: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 2 },
  text: { fontSize: 15, lineHeight: 22, color: '#1E293B' },
  textRight: { color: '#1E293B' }, 
  textLeft: { color: '#1E293B' },
  metaContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 },
  time: { fontSize: 10 },
  timeRight: { color: 'rgba(0,0,0,0.4)' },
  timeLeft: { color: '#94A3B8' },

  // --- DATE HEADER STYLES ---
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateHeaderText: {
    backgroundColor: '#D1D5DB', // Light grey pill
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden', // Required for borderRadius on Text in iOS
  },

  // --- INPUT ---
  inputWrapper: { backgroundColor: '#EFEAE2' }, 
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#fff', marginHorizontal: 10, borderRadius: 30, elevation: 2 },
  attachBtn: { padding: 8 },
  input: { flex: 1, maxHeight: 100, fontSize: 16, paddingHorizontal: 10 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' }
});