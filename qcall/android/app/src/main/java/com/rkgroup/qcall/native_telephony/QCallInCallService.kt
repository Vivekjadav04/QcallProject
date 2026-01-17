package com.rkgroup.qcall.native_telephony

import android.annotation.SuppressLint
import android.app.KeyguardManager // 🟢 Added
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.VideoProfile
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.rkgroup.qcall.CallActivity
import com.rkgroup.qcall.CallManagerModule
import com.rkgroup.qcall.helpers.NotificationHelper

class QCallInCallService : InCallService() {

    companion object {
        var currentCall: Call? = null
        var lastCallerName = "Unknown"
        var lastCallerNumber = ""
        var callStartTime: Long = 0 
        var instance: QCallInCallService? = null

        private var activeRingtone: Ringtone? = null

        fun answerCurrentCall() {
            currentCall?.answer(VideoProfile.STATE_AUDIO_ONLY)
        }
        
        fun hangupCurrentCall() {
            if (currentCall != null) {
                if (currentCall?.state == Call.STATE_RINGING) {
                    currentCall?.reject(false, null)
                } else {
                    currentCall?.disconnect()
                }
            }
        }
        
        fun toggleSpeaker(enable: Boolean) {
            instance?.setAudioRoute(if (enable) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE)
        }
        
        fun setMuted(muted: Boolean) {
            instance?.setMuted(muted)
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        NotificationHelper.createNotificationChannel(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        stopRingtone()
        clearNotification()
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        currentCall = call
        
        val handle = call.details.handle
        val number = handle?.schemeSpecificPart ?: ""
        lastCallerNumber = number

        // Contact Lookup
        lastCallerName = getContactName(this, number)
        callStartTime = 0 

        if (call.state == Call.STATE_RINGING) {
            startRinging()
            
            // Show Notification
            val notification = NotificationHelper.createIncomingCallNotification(this, lastCallerName, lastCallerNumber)
            startForeground(NotificationHelper.NOTIFICATION_ID, notification)
            
            // 🟢 FIX 1: Only Launch Full Screen if Locked
            val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            if (km.isKeyguardLocked) {
                launchCallActivity(lastCallerName, lastCallerNumber, "Incoming")
            }
            // If unlocked, the Notification above is enough.
            
            updateReactAndUI(Call.STATE_RINGING)
        } else {
            // Outgoing
            val notification = NotificationHelper.createOngoingCallNotification(this, lastCallerName, lastCallerNumber)
            startForeground(NotificationHelper.NOTIFICATION_ID, notification)
            
            // 🟢 FIX 2: Start as "Dialing", NOT "Active"
            launchCallActivity(lastCallerName, lastCallerNumber, "Dialing")
            
            updateReactAndUI(Call.STATE_DIALING) // Send Dialing status to React
        }

        call.registerCallback(callCallback)
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        stopRingtone()
        if (currentCall == call) {
            currentCall = null
        }
        sendInternalBroadcast("ACTION_CALL_ENDED")
        updateReactAndUI(Call.STATE_DISCONNECTED)
        clearNotification()
    }

    private val callCallback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            updateReactAndUI(state)
            
            when (state) {
                Call.STATE_ACTIVE -> {
                    stopRingtone()
                    if (callStartTime == 0L) callStartTime = System.currentTimeMillis()
                    
                    // 🟢 Call Connected: Now we tell UI to switch to Active (Start Timer)
                    sendInternalBroadcast("ACTION_CALL_ACTIVE")
                    
                    // Update Notification
                    val notification = NotificationHelper.createOngoingCallNotification(this@QCallInCallService, lastCallerName, lastCallerNumber)
                    val nm = getSystemService(NotificationManager::class.java)
                    nm.notify(NotificationHelper.NOTIFICATION_ID, notification)
                }
                Call.STATE_DISCONNECTED -> {
                    stopRingtone()
                    callStartTime = 0
                    sendInternalBroadcast("ACTION_CALL_ENDED")
                    clearNotification()
                }
            }
        }
    }

    private fun launchCallActivity(name: String, number: String, status: String) {
        val intent = Intent(this, CallActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        intent.putExtra("contact_name", name)
        intent.putExtra("contact_number", number)
        intent.putExtra("call_status", status)
        startActivity(intent)
    }

    @SuppressLint("Range")
    private fun getContactName(context: Context, phoneNumber: String): String {
        if (phoneNumber.isEmpty()) return "Unknown"
        
        var contactName = "Unknown"
        val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber))
        val projection = arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME)
        
        try {
            val cursor: Cursor? = context.contentResolver.query(uri, projection, null, null, null)
            if (cursor != null) {
                if (cursor.moveToFirst()) {
                    contactName = cursor.getString(cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME))
                }
                cursor.close()
            }
        } catch (e: Exception) { }
        
        return if (contactName != "Unknown") contactName else "Unknown"
    }

    private fun startRinging() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            activeRingtone = RingtoneManager.getRingtone(applicationContext, uri)
            activeRingtone?.play()
        } catch (e: Exception) { e.printStackTrace() }
    }
    
    private fun stopRingtone() {
        try {
            if (activeRingtone?.isPlaying == true) activeRingtone?.stop()
        } catch (e: Exception) { }
    }

    private fun clearNotification() {
        stopForeground(true)
        val nm = getSystemService(NotificationManager::class.java)
        nm.cancel(NotificationHelper.NOTIFICATION_ID)
    }
    
    private fun sendInternalBroadcast(action: String) {
        val intent = Intent(action)
        intent.setPackage(packageName)
        sendBroadcast(intent)
    }

    private fun updateReactAndUI(state: Int) {
        val status = when (state) {
            Call.STATE_ACTIVE -> "Active"
            Call.STATE_RINGING -> "Incoming"
            Call.STATE_DIALING -> "Dialing"
            Call.STATE_CONNECTING -> "Dialing"
            Call.STATE_DISCONNECTED -> "Disconnected"
            else -> "Unknown"
        }
        try {
            val params = Arguments.createMap()
            params.putString("status", status)
            CallManagerModule.sendEvent("onCallStateChanged", params)
        } catch (e: Exception) { }
    }
}