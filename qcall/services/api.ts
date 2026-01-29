import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config'; 

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// 🟢 AUTOMATIC TOKEN ATTACHMENT
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const apiService = {
  // --- AUTH ---
  checkUser: async (phoneNumber: string) => {
    try {
      const res = await api.post('/auth/check-user', { phoneNumber });
      return res.data.exists; 
    } catch (e) { return false; }
  },
  
  login: async (phoneNumber: string) => (await api.post('/auth/login', { phoneNumber })).data,
  
  verifyOtp: async (phoneNumber: string, otp: string) => {
    // Note: Ideally this endpoint should verify the OTP, not just login
    const res = await api.post('/auth/login', { phoneNumber, otp }); 
    if (res.data.token) {
      await AsyncStorage.setItem('token', res.data.token);
      if (res.data.user?.id) await AsyncStorage.setItem('user_id', res.data.user.id);
    }
    return res.data;
  },
  
  register: async (userData: any) => {
    const res = await api.post('/auth/register', userData);
    if (res.data.token) {
      await AsyncStorage.setItem('token', res.data.token);
      if (res.data.user?.id) await AsyncStorage.setItem('user_id', res.data.user.id);
    }
    return res.data;
  },

  logout: async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user_id');
  },
  
  isAuthenticated: async () => !!(await AsyncStorage.getItem('token')),

  // --- PROFILE ---
  getProfile: async () => (await api.get('/profile')).data,
  updateProfile: async (data: any) => (await api.put('/profile/update', data)).data,

  // --- CONTACTS ---
  syncContacts: async (contacts: any[], deviceId: string) => {
    const res = await api.post('/contacts/sync', { contacts, deviceId });
    return res.data;
  },
  
  // Internal use for overlay (Simple check)
  identifyCaller: async (number: string) => {
      try { return (await api.get(`/contacts/identify?number=${encodeURIComponent(number)}`)).data; }
      catch (e) { return null; }
  },
  
  // 🟢 SMART SEARCH: "Check from Back" (Suffix Matching)
  // This handles the issue where some numbers have '91' and some don't.
  identifyNumber: async (number: string) => {
    try {
      // 1. Remove all non-numbers (spaces, +, -)
      const rawNum = number.replace(/\D/g, '');

      // 2. EXTRACT LAST 10 DIGITS (The "Back" of the number)
      // Example: If input is "917359219765", this grabs "7359219765"
      const last10 = rawNum.slice(-10); 

      console.log(`🔍 Checking Last 10 Digits: ${last10}`);

      // 3. STRATEGY: Try the most likely formats
      
      // Attempt A: Try the "91" format (Standard India) - Most common in DB
      const queryA = '91' + last10;
      let res = await api.get(`/contacts/identify?number=${encodeURIComponent(queryA)}`);

      // Attempt B: If not found, try the exact 10 digits (Local format)
      if (!res.data.found) {
        console.log(`⚠️ '91' format failed. Trying exact 10 digits: ${last10}`);
        res = await api.get(`/contacts/identify?number=${encodeURIComponent(last10)}`);
      }

      // Attempt C: If input was something vastly different (like a US number), try raw
      if (!res.data.found && rawNum !== last10 && rawNum !== queryA) {
         res = await api.get(`/contacts/identify?number=${encodeURIComponent(rawNum)}`);
      }

      return res.data;

    } catch (e) {
      console.error("Search API Error:", e);
      return { found: false, error: "Network Error" };
    }
  },

  reportSpam: async (data: any) => (await api.post('/contacts/report', data)).data,
};