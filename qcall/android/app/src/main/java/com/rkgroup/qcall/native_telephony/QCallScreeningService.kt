package com.rkgroup.qcall.native_telephony

import android.content.Context
import android.content.SharedPreferences
import android.telecom.Call
import android.telecom.CallScreeningService
import com.rkgroup.qcall.helpers.BlockDataBridge
import android.util.Log

class QCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        if (callDetails.callDirection != Call.Details.DIRECTION_INCOMING) return

        val phoneNumber = callDetails.handle?.schemeSpecificPart
        
        // 1. Is the number manually blocked by the user?
        val isManuallyBlocked = BlockDataBridge.isNumberBlocked(applicationContext, phoneNumber)

        // 2. 🟢 PREMIUM FEATURE CHECK: Auto-Block Spam
        val sharedPref: SharedPreferences = applicationContext.getSharedPreferences("QcallPrefs", Context.MODE_PRIVATE)
        val allowedFeatures = sharedPref.getStringSet("allowedFeatures", emptySet()) ?: emptySet()
        val hasAutoBlockSpam = allowedFeatures.contains("auto_block_spam")

        // In a real scenario, you'd check a local Spam database here. 
        // For now, if it's manually blocked OR (isSpam && hasPremiumAutoBlock)
        val shouldBlock = isManuallyBlocked // || (isKnownSpam(phoneNumber) && hasAutoBlockSpam)

        if (shouldBlock) {
            Log.d("QCallScreening", "🚨 Blocking incoming call from: $phoneNumber")
            
            val response = CallResponse.Builder()
                .setDisallowCall(true)      // Stops ringing
                .setRejectCall(true)        // Rejects call
                .setSkipNotification(true)  // No missed call notification
                .setSkipCallLog(false)      
                .build()
            
            respondToCall(callDetails, response)
        } else {
            Log.d("QCallScreening", "✅ Allowing call from: $phoneNumber")
            respondToCall(callDetails, CallResponse.Builder().build())
        }
    }
}