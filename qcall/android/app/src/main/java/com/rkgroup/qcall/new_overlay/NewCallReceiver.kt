package com.rkgroup.qcall.new_overlay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log

class NewCallReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "QCall-Native"
        
        // Variables to track call state across broadcasts
        private var lastState = TelephonyManager.EXTRA_STATE_IDLE
        private var isOutgoing = false
        private var savedNumber: String? = null
        private var callStartTime: Long = 0
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "📡 Broadcast Received: Action = ${intent.action}")

        // 1. Capture Outgoing Number
        if (intent.action == Intent.ACTION_NEW_OUTGOING_CALL) {
            savedNumber = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER)
            isOutgoing = true
            Log.d(TAG, "📞 Outgoing Call Detected: $savedNumber")
            return
        }

        // 2. Track Phone State Changes
        if (intent.action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
            val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
            
            if (!number.isNullOrEmpty()) {
                savedNumber = number
            }

            Log.d(TAG, "📞 Phone State Changed: $state (Number: $savedNumber)")

            when (state) {
                TelephonyManager.EXTRA_STATE_RINGING -> {
                    // INCOMING CALL
                    isOutgoing = false
                    if (!savedNumber.isNullOrEmpty()) {
                        Log.d(TAG, "🔔 RINGING! Launching Incoming Overlay...")
                        launchOverlay(context, savedNumber!!, false, 0)
                    }
                }
                TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                    // CALL ANSWERED OR DIALING
                    if (lastState != TelephonyManager.EXTRA_STATE_RINGING) {
                        isOutgoing = true // Must be an outgoing call
                    }
                    callStartTime = System.currentTimeMillis()
                }
                TelephonyManager.EXTRA_STATE_IDLE -> {
                    // CALL ENDED
                    if (lastState == TelephonyManager.EXTRA_STATE_OFFHOOK) {
                        val duration = if (callStartTime > 0) ((System.currentTimeMillis() - callStartTime) / 1000).toInt() else 0
                        Log.d(TAG, "🛑 CALL ENDED. Duration: ${duration}s, Outgoing: $isOutgoing")
                        
                        // ONLY SHOW AFTER-CALL OVERLAY IF IT WAS AN OUTGOING CALL
                        if (isOutgoing && !savedNumber.isNullOrEmpty()) {
                            Log.d(TAG, "🚀 Launching After-Call Overlay...")
                            launchOverlay(context, savedNumber!!, true, duration)
                        }
                    }
                    // 🟢 FIX: Reset ALL Tracking Variables completely!
                    isOutgoing = false
                    callStartTime = 0
                    savedNumber = null // <--- THIS KILLS THE STALE DATA BUG
                }
            }
            
            if (state != null) {
                lastState = state
            }
        }
    }

    // Helper to launch the Overlay with correct flags
    private fun launchOverlay(context: Context, number: String, isAfterCall: Boolean, duration: Int) {
        try {
            val i = Intent(context, CallerIdActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                putExtra("number", number)
                putExtra("isAfterCall", isAfterCall)
                putExtra("duration", duration)
            }
            context.startActivity(i)
        } catch (e: Exception) {
            Log.e(TAG, "❌ CRITICAL ERROR: Failed to launch CallerIdActivity", e)
        }
    }
}