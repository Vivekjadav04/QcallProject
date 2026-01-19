import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../constants/config';

// API Configuration
const endpoint = '/profile';
const API_URL = `${API_BASE_URL}${endpoint}`; 

// 🟢 Define Types
interface UserContextType {
  user: any;
  loading: boolean;
  checkUserExists: (phone: string) => Promise<boolean>; // 🟢 NEW FUNCTION
  loadUser: () => Promise<void>;
  login: (phone: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: any) => void;
  saveUserToDB: () => Promise<boolean>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  checkUserExists: async () => false,
  loadUser: async () => {},
  login: async () => false,
  logout: async () => {},
  updateUser: () => {},
  saveUserToDB: async () => false,
});

export const UserProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load User on Startup
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    setLoading(true);
    try {
      const phone = await AsyncStorage.getItem('user_phone');
      
      if (phone) {
        // Fetch fresh data from DB
        const res = await axios.get(`${API_URL}/${phone}`);
        if (res.data.success) {
          setUser(res.data.data);
        } else {
          setUser(null);
        }
      } else {
        setUser(null); // No phone found
      }
    } catch (e) {
      console.log("Failed to load user context", e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // 🟢 1. LOGIC UPDATE: Check Server (Not Local Storage)
  // This function is called by login.tsx to decide whether to show OTP or Register screen
  const checkUserExists = async (phoneNumber: string) => {
    try {
      console.log(`[Context] Checking if ${phoneNumber} exists on server...`);
      // Assuming GET /api/profile/{phone} returns 200 (Found) or 404 (Not Found)
      const res = await axios.get(`${API_URL}/${phoneNumber}`);
      return res.data.success; 
    } catch (e: any) {
      // If server returns 404, it means user does NOT exist
      if (e.response && e.response.status === 404) {
        return false; 
      }
      // If other error (e.g., network), return false to be safe
      return false; 
    }
  };

  // --- LOGIN FUNCTION ---
  const login = async (phoneNumber: string) => {
    try {
      await AsyncStorage.setItem('user_phone', phoneNumber);
      // If you implement tokens later, save them here:
      // await AsyncStorage.setItem('user_token', token);
      
      const res = await axios.get(`${API_URL}/${phoneNumber}`);
      
      if (res.data.success) {
        setUser(res.data.data);
        return true;
      }
    } catch (e) {
      console.log("Login Fetch Error", e);
    }
    return false;
  };

  // --- LOGOUT FUNCTION ---
  const logout = async () => {
    try {
      // 1. Clear all Auth keys
      await AsyncStorage.removeItem('user_phone');
      await AsyncStorage.removeItem('user_token'); 
      
      // 2. Reset State (Triggers AuthGuard)
      setUser(null);
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const updateUser = (updates: any) => {
    setUser((prev: any) => ({ ...prev, ...updates }));
  };

  const saveUserToDB = async () => {
    if (!user || !user.phoneNumber) return false;
    try {
      const { _id, __v, ...dataToSave } = user;
      const res = await axios.put(`${API_URL}/update`, dataToSave);
      if (res.data.success) {
        setUser(res.data.data); 
        return true;
      }
    } catch (error) {
      return false;
    }
    return false;
  };

  return (
    <UserContext.Provider value={{ user, checkUserExists, updateUser, saveUserToDB, login, logout, loading, loadUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);