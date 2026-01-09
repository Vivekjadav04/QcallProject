import { Linking, Alert, Platform } from 'react-native';
import * as SMS from 'expo-sms';

// 1. MAKE A REAL CALL
export const makeCall = (phoneNumber: string) => {
  if (!phoneNumber) return;

  const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
  // 'telprompt:' works better on iOS (asks confirmation), 'tel:' is standard
  let phoneUrl = Platform.OS === 'android' ? `tel:${cleanNumber}` : `telprompt:${cleanNumber}`;

  Linking.canOpenURL(phoneUrl)
    .then((supported) => {
      if (supported) {
        return Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'Calling is not supported on this device/simulator');
      }
    })
    .catch((err) => console.error('An error occurred', err));
};

// 2. SEND A REAL SMS
export const sendSms = async (phoneNumber: string, message?: string) => {
  const isAvailable = await SMS.isAvailableAsync();
  if (isAvailable) {
    // This opens the native Messaging App
    await SMS.sendSMSAsync(
      [phoneNumber],
      message || '' 
    );
  } else {
    Alert.alert('Error', 'SMS is not available on this device');
  }
};