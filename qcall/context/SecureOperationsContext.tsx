import React, { createContext, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { API_BASE_URL } from '../constants/config';

// Define the shape of our new "Secure" context
interface SecureOperationsType {
  blockNumber: (number: string, alsoReport: boolean) => Promise<boolean>;
  reportSpam: (number: string, category: string) => Promise<boolean>;
  markAsSafe: (number: string) => Promise<boolean>;
  getPrivateProfile: (number: string) => Promise<any>;
}

const SecureOperationsContext = createContext<SecureOperationsType | undefined>(undefined);

export const SecureOperationsProvider = ({ children }: { children: ReactNode }) => {

  // 🔒 HELPER: The "Key Fetcher"
  // This reads the token FRESH every time you click a button.
  // It ensures we never use a stale or missing token.
  const getAuthHeaders = async () => {
    try {
      // We look for 'user_token' (saved by your Login flow) OR 'token' (saved by other flows)
      // This covers all bases so it "just works"
      const t1 = await AsyncStorage.getItem('user_token');
      const t2 = await AsyncStorage.getItem('token');
      const finalToken = t1 || t2;

      if (!finalToken) {
        console.warn("[SecureOps] No token found in storage.");
        return null;
      }
      
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalToken}`
      };
    } catch (e) {
      return null;
    }
  };

  // 🔴 FEATURE 1: BLOCK
  const blockNumber = async (number: string, alsoReport: boolean) => {
    const headers = await getAuthHeaders();
    if (!headers) {
      Alert.alert("Authentication Required", "Please log in to block calls.");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/contacts/block`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ number, alsoReportSpam: alsoReport }),
      });

      const data = await response.json();
      if (response.ok) return true;
      
      Alert.alert("Block Failed", data.message || "Server error");
      return false;
    } catch (e) {
      Alert.alert("Error", "Network request failed");
      return false;
    }
  };

  // 🔴 FEATURE 2: REPORT SPAM
  const reportSpam = async (number: string, category: string) => {
    const headers = await getAuthHeaders();
    if (!headers) {
      Alert.alert("Authentication Required", "Please log in to report spam.");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/contacts/report`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
            number, 
            tag: category, 
            location: "Unknown", 
            comment: `Reported as ${category}` 
        }),
      });

      if (response.ok) return true;
      return false;
    } catch (e) {
      return false;
    }
  };

  // 🟢 FEATURE 3: MARK AS SAFE
  const markAsSafe = async (number: string) => {
    const headers = await getAuthHeaders();
    if (!headers) {
        Alert.alert("Auth Error", "You must be logged in.");
        return false;
    }

    try {
      await fetch(`${API_BASE_URL}/contacts/not-spam`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ number }),
      });
      return true;
    } catch (e) {
      return false;
    }
  };

  // 🔵 FEATURE 4: GET PROFILE (With Auth)
  // Use this if you want to see private info that requires login
  const getPrivateProfile = async (number: string) => {
    try {
      // This route is usually public, but we can pass headers just in case
      // needed for future "Friends Only" features
      const response = await fetch(`${API_BASE_URL}/contacts/identify?number=${number}`);
      return await response.json();
    } catch (e) {
      return null;
    }
  };

  return (
    <SecureOperationsContext.Provider value={{ blockNumber, reportSpam, markAsSafe, getPrivateProfile }}>
      {children}
    </SecureOperationsContext.Provider>
  );
};

// Hook to use it easily
export const useSecureOps = () => {
  const context = useContext(SecureOperationsContext);
  if (!context) throw new Error("useSecureOps must be used within SecureOperationsProvider");
  return context;
};