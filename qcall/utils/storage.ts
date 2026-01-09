// utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';

// 1. GET CURRENT USER PHONE (Stored on device)
export const getCurrentUserPhone = async () => {
  try {
    return await AsyncStorage.getItem('user_phone'); 
  } catch (e) {
    return null;
  }
};

// 2. FETCH PROFILE FROM MONGODB
export const getUserProfile = async () => {
  try {
    const phone = await getCurrentUserPhone();
    if (!phone) return null;

    const response = await fetch(`${API_BASE_URL}/profile/${phone}`);
    const json = await response.json();

    if (json.success) {
      return json.data;
    }
    return null;
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
};

// 3. SAVE PROFILE TO MONGODB
export const saveUserProfile = async (userData: any) => {
  try {
    const phone = await getCurrentUserPhone();
    if (!phone) {
      console.error("No logged in user found");
      return false;
    }

    // Combine form data with the phone number
    const payload = { ...userData, phoneNumber: phone };

    const response = await fetch(`${API_BASE_URL}/profile/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await response.json();
    return json.success;
  } catch (error) {
    console.error("Save Error:", error);
    return false;
  }
};