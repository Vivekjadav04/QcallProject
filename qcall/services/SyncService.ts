import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import * as Device from 'expo-device';
import { AppState } from 'react-native';
import { apiService } from './api'; 

const BATCH_SIZE = 50; 
const STORAGE_KEY_INDEX = 'LAST_SYNCED_INDEX';
const STORAGE_KEY_TIME = 'LAST_SYNC_COMPLETION_TIME';
const SYNC_COOLDOWN = 24 * 60 * 60 * 1000; // 24 Hours

export const SyncService = {
  
  startSync: async (force = false) => {
    try {
      console.log("🔄 Sync Service: Initializing...");

      // 1. BATTERY SAVER: Check Cooldown
      const lastRunTime = await AsyncStorage.getItem(STORAGE_KEY_TIME);
      const lastIndex = await AsyncStorage.getItem(STORAGE_KEY_INDEX);
      const now = Date.now();

      // If finished successfully (-1) and cooldown hasn't passed... SKIP.
      if (!force && lastRunTime && lastIndex === '-1') {
        const timePassed = now - parseInt(lastRunTime);
        if (timePassed < SYNC_COOLDOWN) {
          console.log(`⏳ Sync skipped. Wait ${(SYNC_COOLDOWN - timePassed)/1000/60} mins.`);
          return; 
        }
      }

      // 2. GET PERMISSIONS
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log("❌ Sync Permission denied");
        return;
      }

      // 3. FETCH CONTACTS
      const { data: allContacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      console.log(`📱 Found ${allContacts.length} contacts on device.`);

      // 4. RESUME LOGIC (Pick up where we left off)
      let startIndex = (lastIndex && lastIndex !== '-1') ? parseInt(lastIndex) : 0;
      
      // Start the Recursive Loop
      await processBatch(allContacts, startIndex);

    } catch (error) {
      console.error("❌ Sync Error:", error);
    }
  }
};

const processBatch = async (allContacts: any[], startIndex: number) => {
  // A. CHECK IF DONE
  if (startIndex >= allContacts.length) {
    console.log("✅ Sync Complete!");
    await AsyncStorage.setItem(STORAGE_KEY_INDEX, '-1'); // Mark as Done
    await AsyncStorage.setItem(STORAGE_KEY_TIME, Date.now().toString()); // Save Timestamp
    return;
  }

  // B. PREPARE BATCH
  const endIndex = Math.min(startIndex + BATCH_SIZE, allContacts.length);
  const rawBatch = allContacts.slice(startIndex, endIndex);

  // C. CLEAN DATA (Remove dashes, spaces)
  const cleanContacts = rawBatch
    .map(c => {
       const rawNum = c.phoneNumbers?.[0]?.number;
       if (!rawNum) return null;
       return { 
         name: c.name || "Unknown", 
         number: rawNum.replace(/\D/g, '') // Remove non-digits
       }; 
    })
    .filter(c => c && c.number.length >= 5); // Filter invalid numbers

  console.log(`🚀 Uploading batch ${startIndex} - ${endIndex}...`);

  // D. UPLOAD TO BACKEND
  try {
    if (cleanContacts.length > 0) {
        // 🟢 FIX: Use apiService (This handles the Token automatically!)
        await apiService.syncContacts(cleanContacts, Device.modelName || "unknown");
    } else {
        console.log("⚠️ Batch empty after cleaning, skipping upload.");
    }

    // E. SAVE PROGRESS
    await AsyncStorage.setItem(STORAGE_KEY_INDEX, endIndex.toString());

    // F. RECURSION (Keep going if App is open/background)
    if (AppState.currentState === 'active' || AppState.currentState === 'background') {
       processBatch(allContacts, endIndex);
    }

  } catch (err) {
    console.log("⚠️ Upload failed (Network/Auth):", err);
    // We do NOT save the index, so it tries this batch again next time
  }
};