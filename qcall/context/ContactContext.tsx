import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import * as Contacts from 'expo-contacts';
import { SyncService } from '../services/SyncService'; // Import the new service

interface ContactContextType {
  contacts: any[];
  isSyncing: boolean;
  triggerSync: (force?: boolean) => Promise<void>;
}

const ContactContext = createContext<ContactContextType | undefined>(undefined);

export const ContactProvider = ({ children }: { children: ReactNode }) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Load Local Contacts for Display (UI Only)
  const loadLocalContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image, Contacts.Fields.Name],
      });
      if (data.length > 0) {
        setContacts(data);
      }
    }
  };

  // 2. Trigger the Background Sync (Data Upload)
  const triggerSync = async (force = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    // Call the robust service we created
    await SyncService.startSync(force);
    
    // Refresh local UI list
    await loadLocalContacts();
    
    setIsSyncing(false);
  };

  // Initial Load on App Start
  useEffect(() => {
    loadLocalContacts();
    // Try to sync (will stick to cooldown rules)
    SyncService.startSync(false); 
  }, []);

  return (
    <ContactContext.Provider value={{ contacts, isSyncing, triggerSync }}>
      {children}
    </ContactContext.Provider>
  );
};

export const useContacts = () => {
  const context = useContext(ContactContext);
  if (!context) throw new Error('useContacts error');
  return context;
};