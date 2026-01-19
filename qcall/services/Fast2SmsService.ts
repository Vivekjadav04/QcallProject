import { Alert } from 'react-native';

// Your specific DLT details
const API_KEY = "allRLi18i1GiTTJKBvX4EiV3V72dXJlF1QwTaMqpPLdgOFK8Ez6UAsown0Lo";
const SENDER_ID = "JSSINF";
const TEMPLATE_ID = "167634";

export const sendOtpToUser = async (phoneNumber: string, otpCode: string) => {
  try {
    // 1. Clean the number (remove +91, spaces, special chars) and take last 10 digits
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '').slice(-10);

    console.log(`[Fast2SMS] Sending DLT OTP ${otpCode} to ${cleanNumber}`);

    if (!cleanNumber || cleanNumber.length < 10) {
      console.error("Invalid Phone Number");
      return false;
    }

    const url = 'https://www.fast2sms.com/dev/bulkV2';

    // 2. Construct the JSON Body
    const payload = {
      route: "dlt",
      sender_id: SENDER_ID,
      message: TEMPLATE_ID,
      variables_values: `${otpCode}|`, // Keeps the pipe format you used previously
      flash: 0,
      numbers: cleanNumber,
    };

    // 3. Send the Request with correct Headers and Body
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        "authorization": API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("[Fast2SMS] Response:", JSON.stringify(data));

    // 4. Return true if successful
    return data.return === true;

  } catch (error) {
    console.error("[Fast2SMS] Error:", error);
    Alert.alert("SMS Error", "Failed to connect to SMS service.");
    return false;
  }
};