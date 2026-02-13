import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';

// 🟢 1. TypeScript Interface for the Native Bridge
// This tells TS exactly what methods are available in your Kotlin CallManagerModule.kt
interface ICallManagerModule {
  syncBlockToNative: (number: string, isBlocked: boolean) => void;
  isNumberBlockedNative: (number: string) => Promise<boolean>; // Added for testing
}

// 🟢 2. Extract the Module from the Bridge
// We cast it to the interface so TS won't throw "Cannot find name" errors
const { CallManagerModule } = NativeModules as { CallManagerModule: ICallManagerModule };

const BLOCK_KEY = 'blocked_numbers_local';

/**
 * Helper to normalize numbers consistently with the backend.
 * Removes non-numeric characters and keeps the full digit string 
 * to ensure +91 and 0 prefix variations match correctly.
 */
const normalize = (num: string) => num.replace(/[^\d+]/g, '');

export const BlockService = {
  
  // 🔴 Block: Add to list
  blockNumber: async (number: string, name: string = 'Unknown') => {
    try {
      const cleanNum = normalize(number);
      const stored = await AsyncStorage.getItem(BLOCK_KEY);
      const list = stored ? JSON.parse(stored) : [];
      
      if (!list.find((i: any) => i.number === cleanNum)) {
        list.push({ 
          number: cleanNum, 
          name, 
          date: Date.now(),
          syncStatus: 'pending' 
        });
        await AsyncStorage.setItem(BLOCK_KEY, JSON.stringify(list));

        // 🟢 SYNC TO KOTLIN: Intercepts call before ringing
        // Using cleanNum here to ensure the scope is correct
        if (CallManagerModule) {
            CallManagerModule.syncBlockToNative(cleanNum, true);
        }
      }
      return true;
    } catch (e) { 
      console.error("Local block error:", e);
      return false; 
    }
  },

  // 🟢 Unblock: Remove from list
  unblockNumber: async (number: string) => {
    try {
      const cleanNum = normalize(number);
      const stored = await AsyncStorage.getItem(BLOCK_KEY);
      
      if (stored) {
        const list = JSON.parse(stored);
        const newList = list.filter((i: any) => i.number !== cleanNum);
        await AsyncStorage.setItem(BLOCK_KEY, JSON.stringify(newList));

        // 🟢 SYNC TO KOTLIN: Stop declining this number
        if (CallManagerModule) {
            CallManagerModule.syncBlockToNative(cleanNum, false);
        }
      }
      return true;
    } catch (e) { 
      console.error("Local unblock error:", e);
      return false; 
    }
  },

  // 🧪 TEST METHOD: Check SharedPreferences from React Native
  // Call this from a test button in your UI to verify SharedPrefs is working
  checkNativeSyncStatus: async (number: string): Promise<boolean> => {
    try {
      if (CallManagerModule?.isNumberBlockedNative) {
        const result = await CallManagerModule.isNumberBlockedNative(number);
        console.log(`[QCall] Native SharedPrefs check for ${number}: ${result}`);
        return result;
      }
      return false;
    } catch (e) {
      console.error("Native sync check failed:", e);
      return false;
    }
  },

  // ❓ Check Local Status
  isBlocked: async (number: string): Promise<boolean> => {
    try {
      const cleanNum = normalize(number);
      const stored = await AsyncStorage.getItem(BLOCK_KEY);
      if (!stored) return false;
      
      const list = JSON.parse(stored);
      // Fallback check for last 10 digits to handle carrier formatting variations
      return !!list.find((i: any) => i.number.includes(cleanNum.slice(-10)));
    } catch (e) { return false; }
  },

  // 📋 Get Full List
  getBlockedList: async () => {
    try {
      const stored = await AsyncStorage.getItem(BLOCK_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
  }
};