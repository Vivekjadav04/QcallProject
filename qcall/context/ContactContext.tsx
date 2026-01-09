import React, { createContext, useState, useContext, ReactNode } from 'react';
import { PermissionsAndroid, Platform, InteractionManager } from 'react-native';
import * as Contacts from 'expo-contacts';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';

// ⚠️ CONFIRM YOUR IP

const endpoint='/contacts';

const API_URL = `${API_BASE_URL}${endpoint}`; 

interface ContactContextType {
  contacts: any[];
  isSyncing: boolean;
  syncContacts: () => Promise<void>;
}

const ContactContext = createContext<ContactContextType | undefined>(undefined);

export const ContactProvider = ({ children }: { children: ReactNode }) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncContacts = async () => {
    if (isSyncing) return;

    InteractionManager.runAfterInteractions(async () => {
      try {
        setIsSyncing(true);

        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_CONTACTS
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setIsSyncing(false);
            return;
          }
        }

        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image, Contacts.Fields.Name],
        });

        if (data.length > 0) {
          setContacts(data); 

          // 🟢 TS FIX: Added safety checks (?.) and fallback (|| "")
          const formattedContacts = data
            .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0)
            .map(c => {
               // Safely get the number string, defaulting to empty if missing
               const rawNumber = c.phoneNumbers?.[0]?.number || "";
               
               return {
                 name: c.name || "Unknown",
                 number: rawNumber.replace(/\D/g, '').slice(-10)
               };
            })
            // Extra safety: remove any entries that somehow ended up without a number
            .filter(c => c.number.length > 0);

          const token = await AsyncStorage.getItem('token');
          const CHUNK_SIZE = 500; 

          console.log(`🚀 Starting Background Sync: ${formattedContacts.length} contacts`);

          for (let i = 0; i < formattedContacts.length; i += CHUNK_SIZE) {
            const chunk = formattedContacts.slice(i, i + CHUNK_SIZE);
            console.log(`📤 Sending chunk ${i / CHUNK_SIZE + 1}...`);
            
            await axios.post(`${API_URL}/sync`, { contacts: chunk }, {
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
              }
            });
          }
          console.log("✅ All chunks synced successfully!");
        }

      } catch (error) {
        console.error("❌ Background Sync Paused:", error);
      } finally {
        setIsSyncing(false);
      }
    });
  };

  return (
    <ContactContext.Provider value={{ contacts, isSyncing, syncContacts }}>
      {children}
    </ContactContext.Provider>
  );
};

export const useContacts = () => {
  const context = useContext(ContactContext);
  if (!context) throw new Error('useContacts error');
  return context;
};