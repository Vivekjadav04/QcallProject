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
    const res = await api.post('/auth/login', { phoneNumber }); 
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
  
  identifyCaller: async (number: string) => {
     try { return (await api.get(`/contacts/identify?number=${encodeURIComponent(number)}`)).data; }
     catch (e) { return null; }
  },
  
  reportSpam: async (data: any) => (await api.post('/contacts/report', data)).data,
};