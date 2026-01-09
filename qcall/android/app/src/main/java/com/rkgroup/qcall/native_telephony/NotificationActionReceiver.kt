package com.rkgroup.qcall.native_telephony

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telecom.Call
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.rkgroup.qcall.CallManagerModule
import com.rkgroup.qcall.MainActivity

class NotificationActionReceiver : BroadcastReceiver() {

    private val TAG = "QCallActionReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val call = QCallInCallService.currentCall

        Log.d(TAG, "Received Action: $action")

        if ("ACTION_DECLINE" == action) {
            if (call != null) {
                if (call.state == Call.STATE_RINGING) {
                    call.reject(false, null)
                } else {
                    call.disconnect()
                }
                QCallInCallService.currentCall = null
            }
            // Remove notification
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.cancel(QCallInCallService.NOTIFICATION_ID)
        } 
        else if ("ACTION_ACCEPT" == action) {
            if (call != null) {
                // 1. Answer the call natively
                call.answer(0)
                
                // 2. Notify React Native
                val params = Arguments.createMap()
                params.putString("status", "Active")
                CallManagerModule.sendEvent("onCallStateChanged", params)
            }

            // 🟢 3. CRITICAL FIX: FORCE OPEN THE APP UI
            val launchIntent = Intent(context, MainActivity::class.java)
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) 
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            launchIntent.putExtra("call_accepted", true) // Tell JS we just accepted
            context.startActivity(launchIntent)

            // Remove notification
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.cancel(QCallInCallService.NOTIFICATION_ID)
        }
    }
}