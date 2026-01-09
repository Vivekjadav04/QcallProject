import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import { AppState } from 'react-native';

const BATCH_SIZE = 50; 
const STORAGE_KEY_INDEX = 'LAST_SYNCED_INDEX';
const STORAGE_KEY_TIME = 'LAST_SYNC_COMPLETION_TIME';

// 🟢 CONFIG: How often should we check for new contacts?
// 24 Hours = 24 * 60 * 60 * 1000
// 1 Hour = 60 * 60 * 1000
const SYNC_COOLDOWN = 24 * 60 * 60 * 1000; 

export const SyncService = {
  
  startSync: async (force = false) => {
    try {
      // 🟢 1. CHECK COOLDOWN (The Resource Saver)
      const lastRunTime = await AsyncStorage.getItem(STORAGE_KEY_TIME);
      const lastIndex = await AsyncStorage.getItem(STORAGE_KEY_INDEX);
      const now = Date.now();

      // If we are NOT forced, and we finished the last sync, and it's too soon... STOP.
      if (!force && lastRunTime && lastIndex !== null) {
        const timePassed = now - parseInt(lastRunTime);
        const isFinished = parseInt(lastIndex) === -1; // We'll use -1 to mark "Done"

        if (isFinished && timePassed < SYNC_COOLDOWN) {
          console.log(`⏳ Sync skipped. Last sync was ${(timePassed / 1000 / 60).toFixed(1)} mins ago.`);
          return; 
        }
      }

      console.log("🔄 Sync Service: Starting fresh check...");

      // A. Get Permissions & Contacts
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return;

      const { data: allContacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      // B. Determine Start Index
      let startIndex = lastIndex ? parseInt(lastIndex) : 0;
      
      // If marked as "Done" (-1), start over from 0 to check for NEW contacts
      if (startIndex === -1) startIndex = 0;

      // C. Process
      if (startIndex >= allContacts.length) {
        console.log("✅ All contacts up to date.");
        await markSyncComplete();
        return;
      }

      console.log(`📍 Resuming/Starting sync from index: ${startIndex}`);
      await processBatch(allContacts, startIndex);

    } catch (error) {
      console.error("❌ Sync Error:", error);
    }
  }
};

const processBatch = async (allContacts: Contacts.Contact[], startIndex: number) => {
  // Stop if done
  if (startIndex >= allContacts.length) {
    console.log("🎉 Sync Complete! Sleeping until next cooldown.");
    await markSyncComplete();
    return;
  }

  // Prepare Batch
  const endIndex = Math.min(startIndex + BATCH_SIZE, allContacts.length);
  const batch = allContacts.slice(startIndex, endIndex);

  console.log(`🚀 Uploading batch ${startIndex} to ${endIndex}...`);

  // D. UPLOAD (Real Logic)
  try {
     // Replace with your real URL
    // const response = await fetch('https://your-api.com/sync', { ... });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Fake wait
    
    // E. Save Progress (Checkpoint)
    await AsyncStorage.setItem(STORAGE_KEY_INDEX, endIndex.toString());

    // Recursion: Keep going if app is active
    if (AppState.currentState === 'active' || AppState.currentState === 'background') {
       processBatch(allContacts, endIndex);
    }

  } catch (err) {
    console.log("⚠️ Upload failed, saving progress to retry later.");
    // We don't advance the index, so next time it retries this same batch
  }
};

// Helper to mark "Done" and save time
const markSyncComplete = async () => {
  await AsyncStorage.setItem(STORAGE_KEY_INDEX, '-1'); // -1 means "Nothing pending"
  await AsyncStorage.setItem(STORAGE_KEY_TIME, Date.now().toString());
};