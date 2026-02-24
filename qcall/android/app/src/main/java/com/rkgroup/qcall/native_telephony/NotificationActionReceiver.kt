package com.rkgroup.qcall.native_telephony

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.rkgroup.qcall.helpers.NotificationHelper

class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action
        Log.d("NotificationAction", "Action received: $action")
        
        // NOTE: ACTION_ANSWER is no longer handled here. 
        // It is handled directly by the PendingIntent in NotificationHelper 
        // to avoid Android 12+ Notification Trampoline restrictions.

        if (action == "ACTION_DECLINE") {
            // 1. Hangup the active/ringing call
            QCallInCallService.hangupCurrentCall()
            
            // 2. Explicitly dismiss the ringing notification banner!
            try {
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.cancel(NotificationHelper.NOTIFICATION_ID)
            } catch (e: Exception) {
                Log.e("NotificationAction", "Error canceling notification: ${e.message}")
            }
            
            // 3. Attempt to close the Notification Panel pull-down.
            // Wrapped in try-catch because Android 12+ heavily restricts this broadcast.
            try {
                val closeIntent = Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS)
                context.sendBroadcast(closeIntent)
            } catch (e: SecurityException) {
                Log.d("NotificationAction", "Could not close system dialogs (Expected on Android 12+)")
            }
        }
    }
}