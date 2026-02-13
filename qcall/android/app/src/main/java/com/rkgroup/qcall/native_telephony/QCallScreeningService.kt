package com.rkgroup.qcall.native_telephony

import android.telecom.Call
import android.telecom.CallScreeningService
import com.rkgroup.qcall.helpers.BlockDataBridge
import android.util.Log

/**
 * Acts as the gatekeeper for incoming calls. 
 * Intercepts numbers and checks the SharedPreferences vault.
 */
class QCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        // Only screen incoming calls
        if (callDetails.callDirection != Call.Details.DIRECTION_INCOMING) return

        // Extract the phone number safely
        val phoneNumber = callDetails.handle?.schemeSpecificPart
        
        // 🚀 High-speed check against the SharedPreferences vault
        val isBlocked = BlockDataBridge.isNumberBlocked(applicationContext, phoneNumber)

        if (isBlocked) {
            Log.d("QCallScreening", "🚨 Blocking incoming call from: $phoneNumber")
            
            // DECLINE LOGIC: Silent rejection before the phone rings
            val response = CallResponse.Builder()
                .setDisallowCall(true)      // Stops the ringing entirely
                .setRejectCall(true)        // Rejects the call
                .setSkipNotification(true)  // No "Missed Call" alert for blocked numbers
                .setSkipCallLog(false)      // Keep in logs so user sees it was blocked
                .build()
            
            respondToCall(callDetails, response)
        } else {
            Log.d("QCallScreening", "✅ Allowing call from: $phoneNumber")
            
            // ALLOW LOGIC: Let the call proceed to InCallService
            respondToCall(callDetails, CallResponse.Builder().build())
        }
    }
}