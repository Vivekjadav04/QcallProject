import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../constants/config';

// ⚠️ CONFIRM YOUR IP

const endpoint='/profile';

const API_URL = `${API_BASE_URL}${endpoint}`; 

const UserContext = createContext<any>(null);

export const UserProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load User on Startup
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const phone = await AsyncStorage.getItem('user_phone');
      if (phone) {
        // Fetch fresh data from DB
        const res = await axios.get(`${API_URL}/${phone}`);
        if (res.data.success) {
          setUser(res.data.data);
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

  // --- NEW: LOGIN FUNCTION ---
  const login = async (phoneNumber: string) => {
    try {
      await AsyncStorage.setItem('user_phone', phoneNumber);
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

  // --- NEW: LOGOUT FUNCTION ---
  const logout = async () => {
    await AsyncStorage.removeItem('user_phone');
    setUser(null);
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
    // 🔴 ADDED 'loadUser' HERE so register.tsx can use it
    <UserContext.Provider value={{ user, updateUser, saveUserToDB, login, logout, loading, loadUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);