package com.rkgroup.qcall.native_telephony

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.TelecomManager
import android.telecom.VideoProfile
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.rkgroup.qcall.CallActivity
import com.rkgroup.qcall.CallManagerModule
import com.rkgroup.qcall.helpers.ContactHelper 
import com.rkgroup.qcall.helpers.NotificationHelper
import com.rkgroup.qcall.new_overlay.CallerIdActivity

class QCallInCallService : InCallService() {

    // 🟢 VIBRATOR INSTANCE
    private var vibrator: Vibrator? = null

    companion object {
        // 🟢 MULTI-CALL ARCHITECTURE
        val activeCalls = mutableListOf<Call>()
        var currentCall: Call? = null // the primary focus call
        
        var lastCallerName = "Unknown"
        var lastCallerNumber = ""
        var callStartTime: Long = 0 
        var instance: QCallInCallService? = null
        
        var isOutgoingCall = false 
        private var activeRingtone: Ringtone? = null

        var currentAudioState: CallAudioState? = null

        fun answerCurrentCall() {
            stopRingtone()
            currentCall?.answer(VideoProfile.STATE_AUDIO_ONLY)
        }
        
        fun hangupCurrentCall() {
            stopRingtone()
            currentCall?.let {
                if (it.state == Call.STATE_RINGING) it.reject(false, null)
                else it.disconnect()
            }
        }
        
        fun routeAudio(route: Int) {
            instance?.setAudioRoute(route)
        }
        
        fun setMuted(muted: Boolean) {
            instance?.setMuted(muted)
        }

        // 🟢 ADVANCED CALL HANDLING (Hold / Swap / Merge)
        fun holdCall(hold: Boolean) {
            if (hold) currentCall?.hold() else currentCall?.unhold()
        }

        fun mergeCalls() {
            if (activeCalls.size >= 2) {
                val call1 = activeCalls[0]
                val call2 = activeCalls[1]
                call1.conference(call2)
            }
        }

        fun swapCalls() {
            if (activeCalls.size >= 2) {
                val holdingCall = activeCalls.find { it.state == Call.STATE_HOLDING }
                val active = activeCalls.find { it.state == Call.STATE_ACTIVE }
                active?.hold()
                holdingCall?.unhold()
                currentCall = holdingCall
            }
        }
        
        fun playDtmf(char: Char) {
             currentCall?.playDtmfTone(char)
             android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                 currentCall?.stopDtmfTone()
             }, 200)
        }

        // 🟢 STOP RINGTONE AND VIBRATION
        fun stopRingtone() {
            try {
                if (activeRingtone?.isPlaying == true) {
                    activeRingtone?.stop()
                }
                activeRingtone = null
                instance?.vibrator?.cancel()
            } catch (e: Exception) { }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        NotificationHelper.createNotificationChannel(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        stopRingtone()
        clearNotification()
    }

    // 🟢 FETCH BLUETOOTH DEVICE NAME
    override fun onCallAudioStateChanged(audioState: CallAudioState) {
        super.onCallAudioStateChanged(audioState)
        currentAudioState = audioState
        
        var btDeviceName: String? = null
        val isBtAvailable = (audioState.supportedRouteMask and CallAudioState.ROUTE_BLUETOOTH) != 0

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            btDeviceName = audioState.activeBluetoothDevice?.name 
                ?: audioState.supportedBluetoothDevices.firstOrNull()?.name
        }

        val intent = Intent("ACTION_AUDIO_ROUTE_CHANGED")
        intent.putExtra("audioRoute", audioState.route)
        intent.putExtra("isBtAvailable", isBtAvailable)
        intent.putExtra("btDeviceName", btDeviceName ?: "Bluetooth")
        intent.setPackage(packageName)
        sendBroadcast(intent)
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        activeCalls.add(call)
        currentCall = call
        
        val number = call.details.handle?.schemeSpecificPart ?: ""
        lastCallerNumber = number

        val contactInfo = ContactHelper.getContactInfo(this, number)
        lastCallerName = contactInfo.name
        
        if (activeCalls.size == 1) callStartTime = 0 
        isOutgoingCall = call.details.callDirection == Call.Details.DIRECTION_OUTGOING

        sendInternalBroadcast("ACTION_CALL_COUNT_CHANGED")

        if (call.state == Call.STATE_RINGING) {
            val notification = NotificationHelper.createIncomingCallNotification(this, lastCallerName, lastCallerNumber, contactInfo.photo)
            startForeground(NotificationHelper.NOTIFICATION_ID, notification)
            updateReactAndUI(Call.STATE_RINGING)
            
            // 🟢 FIRE CUSTOM RINGTONE & VIBRATION ENGINE
            playCustomRingtoneAndVibration(number)
            
        } else {
            launchCallActivity(lastCallerName, lastCallerNumber, "Dialing")
            updateReactAndUI(Call.STATE_DIALING)
        }

        call.registerCallback(callCallback)
    }

    // ========================================================================
    // 🟢 CUSTOM AUDIO & HAPTICS ENGINE (WITH GLOBAL FALLBACK)
    // ========================================================================
    private fun playCustomRingtoneAndVibration(number: String) {
        try {
            val prefs = getSharedPreferences("QCallContactSettings", Context.MODE_PRIVATE)
            val cleanNumber = number.replace(Regex("[^0-9+]"), "")

            // 1. GET CONTACT SPECIFIC SETTINGS
            var finalUriStr = prefs.getString("ringtone_uri_$cleanNumber", "default")
            var finalVibStr = prefs.getString("vibrate_$cleanNumber", "default")

            // 2. FALLBACK TO GLOBAL APP SETTINGS IF CONTACT IS SET TO DEFAULT
            if (finalUriStr == "default") {
                finalUriStr = prefs.getString("ringtone_uri_GLOBAL_DEFAULT", "default")
            }
            if (finalVibStr == "default") {
                finalVibStr = prefs.getString("vibrate_GLOBAL_DEFAULT", "default")
            }

            // Silence the system's default incoming call ringer so they don't overlap
            val tm = getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            tm.silenceRinger()

            // 3. PLAY THE AUDIO
            val ringtoneUri = when (finalUriStr) {
                "default", null, "" -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                "silent" -> null
                else -> Uri.parse(finalUriStr)
            }

            if (ringtoneUri != null) {
                activeRingtone = RingtoneManager.getRingtone(this, ringtoneUri)
                // Loop the ringtone for Android 9+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    activeRingtone?.isLooping = true
                }
                activeRingtone?.play()
            }

            // 4. PLAY THE VIBRATION PATTERN
            if (vibrator?.hasVibrator() == true && finalVibStr != "silent") {
                // Array format: [Delay, Vibrate, Sleep, Vibrate...]
                val pattern = when (finalVibStr) {
                    "heartbeat" -> longArrayOf(0, 100, 100, 100, 1000)
                    "rapid" -> longArrayOf(0, 200, 200)
                    "sos" -> longArrayOf(0, 200, 200, 200, 200, 200, 200, 500, 500, 500, 500, 500, 500, 200, 200, 200, 200, 200, 200)
                    else -> longArrayOf(0, 1000, 1000) // Default standard ring
                }
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // 0 means loop the pattern from the beginning until cancelled
                    vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(pattern, 0)
                }
            }

        } catch (e: Exception) {
            Log.e("QCallInCallService", "Failed to play custom ringtone: ${e.message}")
            // Fallback safety net
            activeRingtone = RingtoneManager.getRingtone(this, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
            activeRingtone?.play()
        }
    }


    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        activeCalls.remove(call)
        if (currentCall == call) {
            currentCall = activeCalls.firstOrNull()
        }
        
        sendInternalBroadcast("ACTION_CALL_COUNT_CHANGED")

        if (activeCalls.isEmpty()) {
            stopRingtone()
            sendInternalBroadcast("ACTION_CALL_ENDED")
            updateReactAndUI(Call.STATE_DISCONNECTED)
            clearNotification()
        }
    }

    private val callCallback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            updateReactAndUI(state)
            when (state) {
                Call.STATE_ACTIVE -> {
                    stopRingtone()
                    if (callStartTime == 0L) callStartTime = System.currentTimeMillis()
                    sendInternalBroadcast("ACTION_CALL_ACTIVE")
                }
                Call.STATE_HOLDING -> {
                    sendInternalBroadcast("ACTION_CALL_HELD")
                }
                Call.STATE_DISCONNECTED -> {
                    if (activeCalls.isEmpty() && isOutgoingCall) {
                        val duration = if (callStartTime > 0) ((System.currentTimeMillis() - callStartTime) / 1000).toInt() else 0
                        callStartTime = 0
                        launchAfterCallOverlay(lastCallerNumber, lastCallerName, duration)
                    }
                }
            }
        }
    }
    
    private fun launchAfterCallOverlay(number: String, name: String, durationInSeconds: Int) {
        try {
            val intent = Intent(this, CallerIdActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("number", number) 
                putExtra("name", name)
                putExtra("isAfterCall", true)
                putExtra("duration", durationInSeconds) 
            }
            startActivity(intent)
        } catch (e: Exception) {}
    }

    private fun launchCallActivity(name: String, number: String, status: String) {
        val intent = Intent(this, CallActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("contact_name", name)
            putExtra("contact_number", number)
            putExtra("call_status", status)
        }
        startActivity(intent)
    }

    private fun clearNotification() {
        stopForeground(true)
        getSystemService(NotificationManager::class.java).cancel(NotificationHelper.NOTIFICATION_ID)
    }
    
    private fun sendInternalBroadcast(action: String) {
        val intent = Intent(action).setPackage(packageName)
        sendBroadcast(intent)
    }

    private fun updateReactAndUI(state: Int) {
        val status = when (state) {
            Call.STATE_ACTIVE -> "Active"
            Call.STATE_RINGING -> "Incoming"
            Call.STATE_DIALING, Call.STATE_CONNECTING -> "Dialing"
            Call.STATE_HOLDING -> "Holding"
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