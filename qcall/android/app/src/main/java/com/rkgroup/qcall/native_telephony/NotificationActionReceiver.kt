package com.rkgroup.qcall.native_telephony

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telecom.Call
import android.telecom.VideoProfile
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.rkgroup.qcall.CallManagerModule
import com.rkgroup.qcall.MainActivity

class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val call = QCallInCallService.currentCall

        // ✅ STOP RINGTONE INSTANTLY ON ANY ACTION
        QCallInCallService.stopRingtone()

        if (call == null) return

        if ("ACTION_DECLINE" == action) {
            if (call.state == Call.STATE_RINGING) {
                call.reject(false, null)
            } else {
                call.disconnect()
            }
            // Notify JS
            val params = Arguments.createMap()
            params.putString("status", "Disconnected")
            CallManagerModule.sendEvent("onCallStateChanged", params)
        } 
        else if ("ACTION_ACCEPT" == action) {
            call.answer(VideoProfile.STATE_AUDIO_ONLY)
            
            val params = Arguments.createMap()
            params.putString("status", "Active")
            CallManagerModule.sendEvent("onCallStateChanged", params)

            // Force Open Main App for In-Call UI
            val launchIntent = Intent(context, MainActivity::class.java)
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            launchIntent.putExtra("call_accepted", true)
            context.startActivity(launchIntent)
        }
    }
}