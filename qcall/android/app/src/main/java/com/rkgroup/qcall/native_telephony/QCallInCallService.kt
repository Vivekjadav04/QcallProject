package com.rkgroup.qcall.native_telephony

import android.annotation.SuppressLint
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager // 🟢 IMPORTED
import android.media.Ringtone
import android.media.RingtoneManager
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.VideoProfile
import com.facebook.react.bridge.Arguments
import com.rkgroup.qcall.CallActivity
import com.rkgroup.qcall.CallManagerModule
import com.rkgroup.qcall.helpers.ContactHelper // 🟢 IMPORTED
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
            stopRingtone()
            currentCall?.answer(VideoProfile.STATE_AUDIO_ONLY)
        }
        
        fun hangupCurrentCall() {
            stopRingtone()
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
        
        fun playDtmf(char: Char) {
             currentCall?.playDtmfTone(char)
             android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                 currentCall?.stopDtmfTone()
             }, 200)
        }

        fun stopRingtone() {
            try {
                if (activeRingtone?.isPlaying == true) {
                    activeRingtone?.stop()
                }
            } catch (e: Exception) { }
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

        // 🟢 FIX: Use ContactHelper to get Name AND Photo
        val contactInfo = ContactHelper.getContactInfo(this, number)
        lastCallerName = contactInfo.name
        
        callStartTime = 0 

        if (call.state == Call.STATE_RINGING) {
            startRinging()
            
            // 🟢 FIX: Pass the Photo (contactInfo.photo) to the Notification
            // System Notification handles VIBRATION. We handle SOUND.
            val notification = NotificationHelper.createIncomingCallNotification(this, lastCallerName, lastCallerNumber, contactInfo.photo)
            startForeground(NotificationHelper.NOTIFICATION_ID, notification)
            updateReactAndUI(Call.STATE_RINGING)
        } else {
            launchCallActivity(lastCallerName, lastCallerNumber, "Dialing")
            updateReactAndUI(Call.STATE_DIALING)
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
                    sendInternalBroadcast("ACTION_CALL_ACTIVE")
                    
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

    private fun startRinging() {
        try {
            if (activeRingtone?.isPlaying == true) return 

            // 🟢 CRITICAL FIX: Respect Silent/Vibrate Mode
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            if (audioManager.ringerMode != AudioManager.RINGER_MODE_NORMAL) {
                // If phone is on Silent or Vibrate, DO NOT PLAY SOUND.
                // The System Notification will handle vibration.
                return 
            }

            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            activeRingtone = RingtoneManager.getRingtone(applicationContext, uri)
            activeRingtone?.play()
        } catch (e: Exception) { e.printStackTrace() }
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