import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { AccountStat } from '../hooks/useContactFilter';

interface Props {
  visible: boolean;
  onClose: () => void;
  accounts: AccountStat[];
  onToggleAccount: (name: string) => void;
  onToggleAll: (makeVisible: boolean) => void;
}

export default function ContactSettingsSheet({ visible, onClose, accounts, onToggleAccount, onToggleAll }: Props) {
  const totalContacts = accounts.reduce((acc, curr) => acc + curr.count, 0);
  const allVisible = accounts.length > 0 && accounts.every(a => a.isVisible);

  // 🟢 HELPER: Get the right icon based on the account name/type
  const getAccountIcon = (accountName: string, accountType: string) => {
    if (accountName.includes('WhatsApp')) {
      return <FontAwesome5 name="whatsapp" size={22} color="#25D366" />;
    }
    if (accountName.includes('Telegram')) {
      return <FontAwesome5 name="telegram-plane" size={22} color="#0088cc" />;
    }
    if (accountType.includes('google') || accountName.includes('@')) {
      return <MaterialCommunityIcons name="google" size={22} color="#EA4335" />;
    }
    // Default fallback for SIM/Local Phone
    return <MaterialCommunityIcons name="cellphone" size={22} color="#64748B" />;
  };

  // 🟢 HELPER: Get a clean display title
  const getAccountTitle = (accountName: string, accountType: string) => {
    if (accountName.includes('WhatsApp')) return 'WhatsApp';
    if (accountName.includes('Telegram')) return 'Telegram';
    if (accountType.includes('google') || accountName.includes('@')) return 'Google';
    return 'Phone Storage';
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {/* 🟢 All Contacts Master Toggle */}
            <TouchableOpacity 
              style={styles.accountRow} 
              onPress={() => onToggleAll(!allVisible)}
            >
              <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="people" size={22} color="#EF4444" />
              </View>
              <View style={styles.info}>
                <Text style={styles.accountName}>All contacts</Text>
              </View>
              <View style={styles.rightSide}>
                <Text style={styles.countText}>{totalContacts}</Text>
                <Ionicons 
                  name={allVisible ? "radio-button-on" : "radio-button-off"} 
                  size={24} 
                  color={allVisible ? "#EF4444" : "#CBD5E1"} 
                />
              </View>
            </TouchableOpacity>

            {/* Individual Accounts */}
            {accounts.map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.accountRow} 
                onPress={() => onToggleAccount(item.name)}
              >
                <View style={styles.iconBox}>
                  {getAccountIcon(item.name, item.type)}
                </View>
                
                <View style={styles.info}>
                  <Text style={styles.accountName} numberOfLines={1}>
                    {getAccountTitle(item.name, item.type)}
                  </Text>
                  <Text style={styles.accountType} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>

                <View style={styles.rightSide}>
                  <Text style={styles.countText}>{item.count}</Text>
                  <Ionicons 
                    name={item.isVisible ? "radio-button-on" : "radio-button-off"} 
                    size={24} 
                    color={item.isVisible ? "#2563EB" : "#CBD5E1"} 
                  />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, maxHeight: '80%' },
  handle: { width: 40, height: 4, backgroundColor: '#E2E8F0', alignSelf: 'center', marginVertical: 15, borderRadius: 2 },
  accountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  info: { flex: 1, paddingRight: 10 },
  accountName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  accountType: { fontSize: 13, color: '#64748B', marginTop: 2 },
  rightSide: { flexDirection: 'row', alignItems: 'center' },
  countText: { fontSize: 14, fontWeight: '600', color: '#94A3B8', marginRight: 15 }
});