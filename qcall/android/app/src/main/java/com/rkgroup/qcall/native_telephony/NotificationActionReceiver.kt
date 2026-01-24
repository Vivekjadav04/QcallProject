package com.rkgroup.qcall.native_telephony

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action
        
        // NOTE: ACTION_ANSWER is no longer handled here. 
        // It is handled directly by the PendingIntent in NotificationHelper 
        // to avoid Android 12+ Notification Trampoline restrictions.

        if (action == "ACTION_DECLINE") {
            // 1. Hangup the call
            QCallInCallService.hangupCurrentCall()
            
            // 2. Close the Notification Panel (System Dialogs)
            val closeIntent = Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS)
            context.sendBroadcast(closeIntent)
        }
    }
}