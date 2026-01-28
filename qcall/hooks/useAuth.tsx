import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: any;
  loading: boolean;
  updateUser: (newData: any) => void;
  refreshUser: () => Promise<void>;
  saveProfile: (userData: any) => Promise<void>;
  checkUserExists: (phone: string) => Promise<boolean>;
  login: (phone: string) => Promise<any>;
  register: (data: any) => Promise<any>;
  verifyOtp: (phone: string, otp: string) => Promise<any>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 🟢 1. ROBUST INIT: Load User on App Start
  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = async () => {
    try {
      setLoading(true);
      
      const token = await AsyncStorage.getItem('token');
      // A. If we have a local user saved, load it INSTANTLY (Fast/Offline Mode)
      // This is optional, but great for UX. For now, we rely on the token.

      if (token) {
        console.log("[AUTH] Restoring Session...");
        try {
          // B. Try to fetch fresh profile data from server
          const userData = await apiService.getProfile();
          if (userData) {
            setUser(userData);
          } 
        } catch (error: any) {
          console.error("[AUTH] Profile Sync Failed:", error.message);
          
          // 🛑 SENIOR FIX: Only logout if the token is EXPIRED or INVALID (401)
          // If it's 404 (Route Missing) or 500 (Server Down), KEEP THE TOKEN.
          if (error.response && error.response.status === 401) {
            console.log("[AUTH] Token Expired. Logging out.");
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user_id');
            setUser(null);
          } else {
             console.log("[AUTH] Server Error (404/500). Keeping session alive.");
             // Optional: You could load a cached user object here if you had one
          }
        }
      }
    } catch (e) {
      console.error("[AUTH] Storage Read Error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Helper to manually refresh (e.g. pull to refresh)
  const refreshUser = async () => {
     await loadUserFromStorage();
  };

  const updateUser = (newData: any) => {
    setUser((prev: any) => ({ ...prev, ...newData }));
  };

  const saveProfile = async (userData: any) => {
    const response = await apiService.updateProfile(userData);
    setUser(response.data || response);
  };

  const checkUserExists = async (phone: string) => {
    return await apiService.checkUser(phone);
  };

  // 🟢 UPDATED: Instant Login
  const login = async (phone: string) => {
    const data = await apiService.login(phone);
    if (data.user) {
      setUser(data.user);
    } else if (data.token) {
      await refreshUser();
    }
    return data;
  };

  const register = async (data: any) => {
    const res = await apiService.register(data);
    if (res.token) {
        if (res.user) setUser(res.user);
        else await refreshUser();
    }
    return res;
  };

  // 🟢 UPDATED: Instant Verification
  const verifyOtp = async (phone: string, otp: string) => {
    const data = await apiService.verifyOtp(phone, otp);
    if (data.token) {
        if (data.user) setUser(data.user); 
        else await refreshUser(); 
    }
    return data;
  };

  const logout = async () => {
    await apiService.logout();
    await AsyncStorage.removeItem('token'); // Ensure cleanup
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, updateUser, refreshUser, saveProfile, 
      checkUserExists, login, register, verifyOtp, logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};