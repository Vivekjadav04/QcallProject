import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

// 🟢 IMPORT YOUR CONFIG FOR THE API CALL
import { API_BASE_URL } from '../constants/config'; 

const { CallManagerModule } = NativeModules;

/**
 * Define the structure of the Subscription object 
 * as returned by your Node.js backend.
 */
export interface SubscriptionData {
  status: 'active' | 'inactive' | 'none';
  planName: string;
  expiresAt: string | null;
  activeFeatures: string[];
}

export interface UserData {
  _id: string;
  phoneNumber: string;
  subscription?: SubscriptionData;
  accountType?: string; // Kept for legacy fallback if needed
}

/**
 * 1. Automated 24-Hour Premium Sync Service (Passive)
 * Used on normal app launches to save battery and server costs.
 */
export const checkAndSyncPremium = async (userData: UserData | null): Promise<void> => {
  if (!userData) return;

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  try {
    // Retrieve the last sync timestamp from local storage
    const lastSync = await AsyncStorage.getItem('@last_premium_sync');
    const lastSyncTime = lastSync ? parseInt(lastSync, 10) : 0;

    // We only trigger the Native Bridge if 24 hours have passed
    if (now - lastSyncTime < ONE_DAY_MS) {
      console.log("💎 Premium data is fresh. Passive sync skipped.");
      return;
    }

    console.log("🕒 24 Hours passed. Syncing features to Native Android...");

    // Extract features from the validated UserData object
    const activeFeatures: string[] = userData.subscription?.activeFeatures || [];

    // Update Native Kotlin SharedPreferences (The Bridge)
    if (Platform.OS === 'android' && CallManagerModule?.syncPremiumFeatures) {
      CallManagerModule.syncPremiumFeatures(activeFeatures, now);
    }

    // Update local AsyncStorage for React Native UI logic
    await AsyncStorage.setItem('@last_premium_sync', now.toString());
    await AsyncStorage.setItem('@active_features', JSON.stringify(activeFeatures));

    console.log("✅ Passive Sync Complete. Features stored in SharedPreferences.");

  } catch (error) {
    console.error("Premium Sync Error:", error);
  }
};

/**
 * 2. Immediate Force Sync (Bypasses 24h limit)
 * Call this when Pulling-to-Refresh or right after purchasing a plan!
 */
export const forceSyncPremium = async (): Promise<UserData | null> => {
    try {
        console.log("⚡ Initiating FORCED Premium Sync...");
        
        const token = await AsyncStorage.getItem('token');
        if (!token) {
            console.log("Force Sync aborted: No auth token found.");
            return null;
        }

        // ⚠️ NOTE: Change `/profile` if your backend route to get the logged-in user is different (e.g., `/auth/me`)
        const response = await fetch(`${API_BASE_URL}/profile`, { 
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            }
        });

        if (!response.ok) {
            console.log("🔴 Force sync failed. Server returned:", response.status);
            return null;
        }

        const result = await response.json();
        
        // Extract the user object based on your standard API response wrapper
        const freshUser: UserData = result.user || result.data || result; 

        if (!freshUser) {
            console.log("🔴 Force sync failed: Malformed user data.");
            return null;
        }

        // Extract fresh features from DB
        const activeFeatures: string[] = freshUser.subscription?.activeFeatures || [];
        const now = Date.now();
        
        // FORCE UPDATE KOTLIN INSTANTLY
        if (Platform.OS === 'android' && CallManagerModule?.syncPremiumFeatures) {
            CallManagerModule.syncPremiumFeatures(activeFeatures, now);
            console.log("✅ FORCED SYNC: Kotlin SharedPreferences updated instantly with:", activeFeatures);
        }

        // Reset the 24-hour clock so it doesn't trigger again today
        await AsyncStorage.setItem('@last_premium_sync', now.toString());
        await AsyncStorage.setItem('@active_features', JSON.stringify(activeFeatures));

        return freshUser; // Return the fresh user so the UI can update if needed
        
    } catch (error) {
        console.error("🔴 Force Sync Catch Error:", error);
        return null;
    }
};