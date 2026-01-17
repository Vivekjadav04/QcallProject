package com.rkgroup.qcall

import android.app.Activity
import android.app.NotificationManager
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
import com.rkgroup.qcall.helpers.NotificationHelper 

class CallManagerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val TAG = "CallManagerModule"

    companion object {
        var reactAppContext: ReactApplicationContext? = null

        fun sendEvent(eventName: String, params: WritableMap?) {
            try {
                reactAppContext
                    ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit(eventName, params)
            } catch (e: Exception) {
                Log.e("CallManagerModule", "Error sending event: ${e.message}")
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
        QCallInCallService.answerCurrentCall()
    }

    // 🟢 2. END CALL
    @ReactMethod
    fun endCall() {
        QCallInCallService.hangupCurrentCall()
    }

    // 🟢 3. START CALL
    @ReactMethod
    fun startCall(number: String) {
        Log.d(TAG, "Starting call to: $number")
        val context = reactApplicationContext
        val uri = Uri.parse("tel:" + number.replace("#", "%23"))
        
        try {
            val tm = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            tm.placeCall(uri, null)
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission Error: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting call: ${e.message}")
        }
    }

    // 🟢 4. AUDIO CONTROLS
    @ReactMethod
    fun setMuted(muted: Boolean) {
        QCallInCallService.setMuted(muted)
    }

    @ReactMethod
    fun setSpeakerphoneOn(on: Boolean) {
        QCallInCallService.toggleSpeaker(on)
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

    // 🟢 6. DEFAULT DIALER CHECKS
    @ReactMethod
    fun checkIsDefaultDialer(promise: Promise) {
        try {
            val context = reactApplicationContext
            val packageName = context.packageName
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
                val isDefault = roleManager.isRoleHeld(RoleManager.ROLE_DIALER)
                promise.resolve(isDefault)
            } else {
                val tm = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
                val isDefault = tm.defaultDialerPackage == packageName
                promise.resolve(isDefault)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking default dialer: ${e.message}")
            promise.resolve(false)
        }
    }

    // 🟢 7. REQUEST DEFAULT DIALER (Fixed Error)
    @ReactMethod
    fun requestDefaultDialer(promise: Promise) {
        try {
            val context: Context = reactApplicationContext
            // FIX: Explicitly call getCurrentActivity() instead of using property access
            val activity: Activity? = getCurrentActivity() 
            val packageName = context.packageName

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
                
                if (activity != null) {
                    activity.startActivityForResult(intent, 1)
                    promise.resolve(true)
                } else {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    promise.resolve(true)
                }
            } else {
                val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER)
                intent.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, packageName)
                
                if (activity != null) {
                    activity.startActivity(intent)
                    promise.resolve(true)
                } else {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    promise.resolve(true)
                }
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    // 🟢 8. DEBUG METHODS
    @ReactMethod
    fun launchTestIncomingUI(name: String, number: String) {
        try {
            val intent = Intent(reactApplicationContext, CallActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            
            intent.putExtra("contact_name", name)
            intent.putExtra("contact_number", number)
            intent.putExtra("call_status", "Incoming") 
            
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error launching Incoming UI: ${e.message}")
        }
    }

    @ReactMethod
    fun launchTestOutgoingUI(name: String, number: String) {
        try {
            val intent = Intent(reactApplicationContext, CallActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            
            intent.putExtra("contact_name", name)
            intent.putExtra("contact_number", number)
            intent.putExtra("call_status", "Active") 
            
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error launching Outgoing UI: ${e.message}")
        }
    }

    @ReactMethod
    fun showTestNotification(name: String, number: String) {
        try {
            val context = reactApplicationContext
            NotificationHelper.createNotificationChannel(context)
            val notification = NotificationHelper.createIncomingCallNotification(context, name, number)
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(999, notification)
        } catch (e: Exception) {
            Log.e(TAG, "Error showing test notification: ${e.message}")
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}