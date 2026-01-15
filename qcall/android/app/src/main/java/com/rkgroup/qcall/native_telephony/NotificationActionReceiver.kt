package com.rkgroup.qcall.native_telephony

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.rkgroup.qcall.CallManagerModule

class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        
        // 🟢 WORKFLOW:
        // 1. User clicks "Answer" or "Decline" on the System Notification.
        // 2. This Receiver catches the click.
        // 3. We tell QCallInCallService to perform the Telecom action.
        // 4. We notify React Native (JS) to update the in-app UI if open.
        // 5. We DO NOT open the Activity here. The Service will do it when the state changes.

        // 1. Handle DECLINE
        if ("ACTION_DECLINE" == action) {
            QCallInCallService.hangupCurrentCall()
            
            // Notify JS (React Native)
            try {
                val params = Arguments.createMap()
                params.putString("status", "Disconnected")
                CallManagerModule.sendEvent("onCallStateChanged", params)
            } catch (e: Exception) {
                // React Context might be null if app is backgrounded/killed
            }
        } 
        // 2. Handle ANSWER
        else if ("ACTION_ANSWER" == action) {
            QCallInCallService.answerCurrentCall()
            
            // Notify JS (React Native)
            try {
                val params = Arguments.createMap()
                params.putString("status", "Active")
                CallManagerModule.sendEvent("onCallStateChanged", params)
            } catch (e: Exception) {
                // React Context might be null
            }
        }
    }
}