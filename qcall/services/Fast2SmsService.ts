// services/Fast2SmsService.ts

// Your specific DLT details
const API_KEY = "fxacpnXw4KD52NBvTdkQzZyu19HSEG7mYilFPr0Ose8tVLqhCJxSJhkFX18AqIpoECgN0yuDLfc24RzY";
const SENDER_ID = "JSSINF";
const TEMPLATE_ID = "167634"; // This is the 'message' parameter in your URL

export const sendOtpToUser = async (phoneNumber: string, otpCode: string) => {
  try {
    // 1. Clean the number (remove +91, spaces)
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '').slice(-10);

    console.log(`[Fast2SMS] Sending DLT OTP ${otpCode} to ${cleanNumber}`);

    if (!cleanNumber || cleanNumber.length < 10) {
      console.error("Invalid Phone Number");
      return false;
    }

    // 2. Construct the specific DLT URL
    const url = 'https://www.fast2sms.com/dev/bulkV2';
    
    // We match YOUR provided URL structure exactly
    const params = new URLSearchParams({
      authorization: API_KEY,
      route: 'dlt',                   // Changed from 'otp' to 'dlt'
      sender_id: SENDER_ID,           // Your Sender ID (JSSINF)
      message: TEMPLATE_ID,           // Your Template ID (167634)
      variables_values: `${otpCode}|`, // Replaces '12345|' with dynamic OTP
      flash: '0',
      numbers: cleanNumber            // Replaces '955848...' with user's number
    });

    // 3. Send Request
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
    });

    const data = await response.json();
    console.log("[Fast2SMS] Response:", JSON.stringify(data));

    return data.return === true;

  } catch (error) {
    console.error("[Fast2SMS] Error:", error);
    return false;
  }
};