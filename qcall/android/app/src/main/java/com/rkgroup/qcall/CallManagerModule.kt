package com.rkgroup.qcall

import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.telecom.Call
import android.telecom.TelecomManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.rkgroup.qcall.native_telephony.QCallInCallService

// 🟢 CORRECT IMPORTS
import com.rkgroup.qcall.IncomingCallActivity
import com.rkgroup.qcall.OngoingCallActivity

class CallManagerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val TAG = "QCallDebug"

    companion object {
        var reactAppContext: ReactApplicationContext? = null

        fun sendEvent(eventName: String, params: WritableMap?) {
            try {
                reactAppContext
                    ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit(eventName, params)
            } catch (e: Exception) {
                Log.e("QCallDebug", "Error sending event: ${e.message}")
            }
        }
    }

    init {
        reactAppContext = reactContext
    }

    override fun getName(): String = "CallManagerModule"

    // 🟢 1. ANSWER CALL
    @ReactMethod
    fun answerCall() {
        Log.d(TAG, "Attempting to answer call...")
        val call = QCallInCallService.currentCall
        if (call != null) {
            QCallInCallService.answerCurrentCall()
            
            val params = Arguments.createMap()
            params.putString("status", "Active")
            sendEvent("onCallStateChanged", params)
        } else {
            Log.e(TAG, "FAILED to answer: currentCall is null")
        }
    }

    // 🟢 2. END CALL
    @ReactMethod
    fun endCall() {
        Log.d(TAG, "Attempting to end call...")
        val call = QCallInCallService.currentCall
        if (call != null) {
            QCallInCallService.hangupCurrentCall()
        } else {
            Log.e(TAG, "FAILED to end: currentCall is null")
        }
    }

    // 🟢 3. START CALL (Real Call)
    @ReactMethod
    fun startCall(number: String) {
        Log.d(TAG, "Starting call to: $number")
        try {
            val uri = Uri.parse("tel:$number")
            val intent = Intent(Intent.ACTION_CALL, uri)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            
            // 1. Start the System Call
            // We do NOT manually open our UI here anymore.
            // We rely on QCallInCallService to detect the call and open the UI.
            // This prevents the "Double Screen" or "Overlap" issue.
            
            val activity: Activity? = reactApplicationContext.currentActivity
            if (activity != null) {
                activity.startActivity(intent)
            } else {
                reactApplicationContext.startActivity(intent)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error starting call: ${e.message}")
        }
    }

    // 🟢 4. AUDIO CONTROLS
    @ReactMethod
    fun setMuted(muted: Boolean) {
        try {
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.isMicrophoneMute = muted
        } catch (e: Exception) {
            Log.e(TAG, "Error setting mute: ${e.message}")
        }
    }

    @ReactMethod
    fun setSpeakerphoneOn(on: Boolean) {
        try {
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.isSpeakerphoneOn = on
        } catch (e: Exception) {
            Log.e(TAG, "Error setting speaker: ${e.message}")
        }
    }

    // 🟢 5. GET STATUS
    @ReactMethod
    fun getCurrentCallStatus(promise: Promise) {
        val call = QCallInCallService.currentCall
        val map = Arguments.createMap()
        
        if (call != null) {
            val status = when (call.state) {
                Call.STATE_ACTIVE -> "Active"
                Call.STATE_RINGING -> "Incoming"
                Call.STATE_DIALING -> "Dialing"
                Call.STATE_CONNECTING -> "Dialing"
                Call.STATE_DISCONNECTED -> "Disconnected"
                else -> "Connected"
            }
            map.putString("status", status)
            map.putString("name", QCallInCallService.lastCallerName)
            map.putString("number", QCallInCallService.lastCallerNumber)
        } else {
            map.putString("status", "Idle")
        }
        promise.resolve(map)
    }

    @ReactMethod
    fun getActiveCallInfo(promise: Promise) {
        getCurrentCallStatus(promise)
    }

    // 🟢 7. DEFAULT DIALER CHECKS
    @ReactMethod
    fun checkIsDefaultDialer(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = reactApplicationContext.getSystemService(Context.ROLE_SERVICE) as RoleManager
                val isDefault = roleManager.isRoleHeld(RoleManager.ROLE_DIALER)
                promise.resolve(isDefault)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val telecomManager = reactApplicationContext.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
                val isDefault = telecomManager.defaultDialerPackage == reactApplicationContext.packageName
                promise.resolve(isDefault)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking default dialer: ${e.message}")
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestDefaultDialer(promise: Promise) {
        try {
            val intent: Intent? = when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> {
                    val roleManager = reactApplicationContext.getSystemService(Context.ROLE_SERVICE) as RoleManager
                    if (roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
                        roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
                    } else null
                }
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M -> {
                    Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
                        putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, reactApplicationContext.packageName)
                    }
                }
                else -> null
            }

            if (intent != null) {
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                val activity: Activity? = reactApplicationContext.currentActivity
                if (activity != null) {
                    activity.startActivity(intent)
                } else {
                    reactApplicationContext.startActivity(intent)
                }
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    // ==========================================================
    // 🟢 8 & 9. DEBUG METHODS (FOR TEST BUTTONS)
    // ==========================================================

    @ReactMethod
    fun launchTestIncomingUI(name: String, number: String) {
        try {
            Log.d(TAG, "DEBUG: Launching IncomingCallActivity")
            val intent = Intent(reactApplicationContext, IncomingCallActivity::class.java)
            
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            
            // Pass Data matching IncomingCallActivity logic
            intent.putExtra("contact_name", name)
            intent.putExtra("contact_number", number)
            intent.putExtra("is_test_mode", true)
            
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error launching Incoming UI: ${e.message}")
        }
    }

    @ReactMethod
    fun launchTestOutgoingUI(name: String, number: String) {
        try {
            Log.d(TAG, "DEBUG: Launching OngoingCallActivity")
            val intent = Intent(reactApplicationContext, OngoingCallActivity::class.java)
            
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            
            // Pass Data matching OngoingCallActivity logic
            intent.putExtra("contact_name", name)
            intent.putExtra("contact_number", number)
            intent.putExtra("is_test_mode", true)
            
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error launching Outgoing UI: ${e.message}")
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}