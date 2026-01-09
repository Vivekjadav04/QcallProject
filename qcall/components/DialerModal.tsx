import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  Dimensions, 
  Pressable, 
  Vibration,
  FlatList,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const BUTTON_SIZE = width / 5.5;     
const SPACING = 15;                  

const COLORS = {
  background: '#F2F2F7',
  headerBg: '#F2F2F7',
  keyBtn: '#FFFFFF',           
  keyBtnPressed: '#D1D1D6',    
  keyText: '#000000',          
  keySubText: '#000000',
  callBtn: '#34C759',
  deleteBtn: '#8E8E93',
  backIcon: '#000000',
  input: '#000000',
  addContact: '#007AFF',       
  listItemBg: '#FFFFFF',
  textMain: '#000000',
  textSub: '#8E8E93',
  separator: '#C6C6C8'
};

interface DialerProps {
  visible: boolean;
  onClose: () => void;
  masterLogs: any[]; 
  onCallPress: (name: string | null, number: string) => void;
}

export default function DialerModal({ visible, onClose, masterLogs, onCallPress }: DialerProps) {
  const [number, setNumber] = useState('');

  // 🟢 Optimized Match Logic: Memoize the search to prevent lag
  const matches = useMemo(() => {
    const cleanQuery = number.replace(/\D/g, '');
    if (cleanQuery.length === 0) return [];

    const filtered = masterLogs.filter(item => {
      if (!item.number) return false;
      const cleanSource = item.number.replace(/\D/g, '');
      return cleanSource.includes(cleanQuery);
    });

    // Unique by number
    return filtered
      .filter((v, i, a) => a.findIndex(t => t.number === v.number) === i)
      .slice(0, 20); // Only show top 20 for better performance
  }, [number, masterLogs]);

  useEffect(() => {
    if (visible) {
      setNumber('');
    }
  }, [visible]);

  const handlePress = useCallback((val: string) => {
    Vibration.vibrate(10); // 🟢 Immediate haptic feedback
    setNumber(prev => prev + val);
  }, []);

  const handleDelete = useCallback(() => {
    Vibration.vibrate(10);
    setNumber(prev => prev.slice(0, -1));
  }, []);

  const handleCall = (targetName: string | null, targetNumber: string) => {
    const num = targetNumber || number;
    if (num.length > 0) {
        onCallPress(targetName, num);
        setNumber('');
        onClose();
    }
  };

  const KeyBtn = React.memo(({ main, sub }: { main: string, sub?: string }) => (
    <Pressable
      style={({ pressed }) => [
        styles.keyBtn,
        pressed && { backgroundColor: COLORS.keyBtnPressed }
      ]}
      onPress={() => handlePress(main)}
    >
      <Text style={styles.keyMain}>{main}</Text>
      {!!sub && <Text style={styles.keySub}>{sub}</Text>}
    </Pressable>
  ));

  const renderMatch = ({ item }: { item: any }) => (
    <TouchableOpacity 
        style={styles.matchRow} 
        onPress={() => handleCall(item.name, item.number)}
    >
       <View style={styles.matchAvatar}>
          <Text style={styles.matchAvatarText}>{item.name ? item.name[0].toUpperCase() : '#'}</Text>
       </View>
       <View style={styles.matchInfo}>
          <Text style={styles.matchName} numberOfLines={1}>{item.name || 'Unknown'}</Text>
          <Text style={styles.matchNumber}>{item.number}</Text>
       </View>
       <Ionicons name="call-outline" size={24} color={COLORS.addContact} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={COLORS.backIcon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dialer</Text>
          <View style={{width: 28}} />
        </View>

        <View style={styles.listContainer}>
           {matches.length > 0 ? (
             <FlatList 
               data={matches}
               keyExtractor={(item, index) => item.number + index}
               renderItem={renderMatch}
               ItemSeparatorComponent={() => <View style={styles.separator} />}
               showsVerticalScrollIndicator={false}
               keyboardShouldPersistTaps="handled"
               initialNumToRender={10}
               maxToRenderPerBatch={10}
             />
           ) : (
              <View style={styles.emptyState}>
                 <Text style={styles.emptyText}>
                   {number.length === 0 ? 'Start typing...' : 'No contacts found'}
                 </Text>
              </View>
           )}
        </View>

        <View style={styles.bottomSection}>
          <View style={styles.displayContainer}>
             <Text style={styles.numberText} numberOfLines={1} adjustsFontSizeToFit>
               {number}
             </Text>
             {number.length > 0 && (
               <TouchableOpacity>
                 <Text style={styles.addContactText}>+ Create New Contact</Text>
               </TouchableOpacity>
             )}
          </View>

          <View style={styles.keypadContainer}>
             <View style={styles.row}><KeyBtn main="1" /><KeyBtn main="2" sub="ABC" /><KeyBtn main="3" sub="DEF" /></View>
             <View style={styles.row}><KeyBtn main="4" sub="GHI" /><KeyBtn main="5" sub="JKL" /><KeyBtn main="6" sub="MNO" /></View>
             <View style={styles.row}><KeyBtn main="7" sub="PQRS" /><KeyBtn main="8" sub="TUV" /><KeyBtn main="9" sub="WXYZ" /></View>
             <View style={styles.row}><KeyBtn main="*" /><KeyBtn main="0" sub="+" /><KeyBtn main="#" /></View>

             <View style={styles.callRow}>
               <View style={[styles.keyBtn, { backgroundColor: 'transparent', elevation: 0 }]} />
               <TouchableOpacity 
                    style={styles.callBtn} 
                    onPress={() => handleCall(null, number)}
                >
                 <MaterialIcons name="call" size={32} color="#FFF" />
               </TouchableOpacity>
               <View style={styles.backspaceContainer}>
                 {number.length > 0 && (
                   <TouchableOpacity onPress={handleDelete} onLongPress={() => setNumber('')}>
                     <Ionicons name="backspace" size={30} color={COLORS.deleteBtn} />
                   </TouchableOpacity>
                 )}
               </View>
             </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: COLORS.headerBg, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
  listContainer: { flex: 1, backgroundColor: '#FFF', marginHorizontal: 15, marginTop: 10, marginBottom: 10, borderRadius: 15, paddingHorizontal: 10, overflow: 'hidden', elevation: 2 },
  matchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  matchAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E5EA', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  matchAvatarText: { color: '#000', fontSize: 18, fontWeight: '600' },
  matchInfo: { flex: 1 },
  matchName: { color: COLORS.textMain, fontSize: 16, fontWeight: '600' },
  matchNumber: { color: COLORS.textSub, fontSize: 14 },
  separator: { height: 1, backgroundColor: COLORS.separator, marginLeft: 55 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#8E8E93', fontSize: 16 },
  bottomSection: { paddingHorizontal: 20, paddingBottom: 40 },
  displayContainer: { height: 80, justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 5 },
  numberText: { fontSize: 34, fontWeight: '500', color: COLORS.input, letterSpacing: 1 },
  addContactText: { color: COLORS.addContact, fontSize: 14, fontWeight: '600', marginTop: 5 },
  keypadContainer: { width: '100%' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING },
  keyBtn: { width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2, backgroundColor: COLORS.keyBtn, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  keyMain: { fontSize: 28, color: COLORS.keyText, fontWeight: '400' },
  keySub: { fontSize: 10, color: COLORS.keyText, fontWeight: '700', letterSpacing: 2, marginTop: -2 },
  callRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  callBtn: { width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2, backgroundColor: COLORS.callBtn, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  backspaceContainer: { width: BUTTON_SIZE, height: BUTTON_SIZE, justifyContent: 'center', alignItems: 'center' }
});