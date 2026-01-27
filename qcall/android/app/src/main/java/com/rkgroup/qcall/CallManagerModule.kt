package com.rkgroup.qcall

import android.app.Activity
import android.app.NotificationManager
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings // 🟢 ADDED THIS IMPORT
import android.telecom.TelecomManager
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.rkgroup.qcall.native_telephony.QCallInCallService
import com.rkgroup.qcall.helpers.NotificationHelper 
import com.rkgroup.qcall.new_overlay.CallerIdActivity 

class CallManagerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val TAG = "CallManagerModule"
    private val REQUEST_ID = 1

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
        NotificationHelper.createNotificationChannel(reactContext)
    }

    override fun getName(): String = "CallManagerModule"

    @ReactMethod
    fun answerCall() {
        QCallInCallService.answerCurrentCall()
    }

    @ReactMethod
    fun endCall() {
        QCallInCallService.hangupCurrentCall()
    }

    @ReactMethod
    fun startCall(number: String) {
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

    @ReactMethod
    fun setMuted(muted: Boolean) {
        QCallInCallService.instance?.setMuted(muted)
    }

    @ReactMethod
    fun setSpeakerphoneOn(on: Boolean) {
        QCallInCallService.toggleSpeaker(on)
    }

    // 🟢 NEW: Check Overlay Permission
    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
            } else {
                promise.resolve(true) // Not needed below Android 6
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // 🟢 NEW: Open Overlay Settings Page
    @ReactMethod
    fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + reactApplicationContext.packageName))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun checkIsDefaultDialer(promise: Promise) {
        val context = reactApplicationContext
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
            promise.resolve(roleManager.isRoleHeld(RoleManager.ROLE_DIALER))
        } else {
            val tm = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            promise.resolve(tm.defaultDialerPackage == context.packageName)
        }
    }

    @ReactMethod
    fun requestDefaultDialer(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        val context = reactApplicationContext

        if (activity == null) {
            promise.reject("ACTIVITY_NULL", "Activity is null")
            return
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
                activity.startActivityForResult(intent, REQUEST_ID)
            } else {
                val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER)
                intent.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, context.packageName)
                activity.startActivityForResult(intent, REQUEST_ID)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun launchTestIncomingUI(name: String, number: String) {
        try {
            val intent = Intent(reactApplicationContext, CallerIdActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("number", number) 
                putExtra("name", name)
            }
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error launching Incoming UI: ${e.message}")
        }
    }

    @ReactMethod
    fun launchTestOutgoingUI(name: String, number: String) {
        try {
            val intent = Intent(reactApplicationContext, com.rkgroup.qcall.CallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                putExtra("contact_name", name)
                putExtra("contact_number", number)
                putExtra("call_status", "Active")
            }
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
            
            val notification = NotificationHelper.createIncomingCallNotification(context, name, number, null)
            
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NotificationHelper.NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.e(TAG, "Error showing test notification: ${e.message}")
        }
    }
    
    @ReactMethod
    fun addListener(eventName: String) {}
    @ReactMethod
    fun removeListeners(count: Int) {}
}