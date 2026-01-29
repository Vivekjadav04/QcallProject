package com.rkgroup.qcall.new_overlay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log

class NewCallReceiver : BroadcastReceiver() {

    // 🟢 Tag for Logcat Filtering: adb logcat -s QCall-Native
    companion object {
        private const val TAG = "QCall-Native"
    }

    override fun onReceive(context: Context, intent: Intent) {
        // 1. Log every broadcast received to ensure the receiver is alive
        Log.d(TAG, "📡 Broadcast Received: Action = ${intent.action}")

        if (intent.action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
            Log.d(TAG, "📞 Phone State Changed: $state")

            // 2. Only act on RINGING
            if (state == TelephonyManager.EXTRA_STATE_RINGING) {
                val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
                
                if (!incomingNumber.isNullOrEmpty()) {
                    Log.d(TAG, "🔔 RINGING Detected! Incoming Number: $incomingNumber")
                    
                    try {
                        Log.d(TAG, "🚀 Attempting to launch CallerIdActivity...")
                        
                        val i = Intent(context, CallerIdActivity::class.java)
                        // Critical Flags for starting Activity from a BroadcastReceiver
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        i.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                        i.addFlags(Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                        
                        // Pass the number payload
                        i.putExtra("number", incomingNumber)
                        
                        context.startActivity(i)
                        Log.d(TAG, "✅ CallerIdActivity Launch Intent Sent Successfully")
                        
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ CRITICAL ERROR: Failed to launch CallerIdActivity", e)
                    }
                } else {
                    Log.w(TAG, "⚠️ State is RINGING, but Incoming Number is NULL or Empty")
                }
            }
        }
    }
}