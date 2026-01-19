package com.rkgroup.qcall.native_telephony

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.rkgroup.qcall.CallActivity

class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action
        
        if (action == "ACTION_ANSWER") {
            // 1. Tell Service to Answer
            QCallInCallService.answerCurrentCall()
            
            // 2. Open UI in Active Mode
            val uiIntent = Intent(context, CallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                putExtra("call_status", "Active")
            }
            context.startActivity(uiIntent)
            
            // 3. Close Notif Panel
            context.sendBroadcast(Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS))

        } else if (action == "ACTION_DECLINE") {
            // 1. Hangup
            QCallInCallService.hangupCurrentCall()
            
            // 2. Close Notif Panel
            context.sendBroadcast(Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS))
        }
    }
}