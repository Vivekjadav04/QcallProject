package com.rkgroup.qcall.native_telephony

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.rkgroup.qcall.CallActivity // 🟢 Points to the Single Activity

class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        // Safety check: if intent is null, stop
        if (intent == null) return

        val action = intent.action
        
        if ("ACTION_ANSWER" == action) {
            // 1. Tell Service to Answer
            QCallInCallService.answerCurrentCall()
            
            // 2. Open UI (CallActivity)
            val uiIntent = Intent(context, CallActivity::class.java)
            uiIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            uiIntent.putExtra("call_status", "Active") // Show Buttons
            context.startActivity(uiIntent)
            
        } else if ("ACTION_DECLINE" == action) {
            // 1. Tell Service to Hangup
            QCallInCallService.hangupCurrentCall()
        }
    }
}