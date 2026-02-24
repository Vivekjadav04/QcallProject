package com.rkgroup.qcall

import android.app.NotificationManager
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.provider.Settings 
import android.telecom.TelecomManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.rkgroup.qcall.native_telephony.QCallInCallService
import com.rkgroup.qcall.helpers.NotificationHelper 
import com.rkgroup.qcall.helpers.BlockDataBridge 
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

    // 🟢 UPDATED: Automatic 24-Hour Sync Logic
    // Features: Array of feature keys (e.g., ["no_ads", "golden_caller_id"])
    // timestamp: The time in milliseconds when the API was fetched
    @ReactMethod
    fun syncPremiumFeatures(features: ReadableArray, timestamp: Double) {
        val sharedPref: SharedPreferences = reactApplicationContext.getSharedPreferences("QcallPrefs", Context.MODE_PRIVATE)
        val editor = sharedPref.edit()
        
        val featureSet = mutableSetOf<String>()
        for (i in 0 until features.size()) {
            features.getString(i)?.let { featureSet.add(it) }
        }
        
        // Save both the features and the time they were fetched
        editor.putStringSet("allowedFeatures", featureSet)
        editor.putLong("lastPremiumSync", timestamp.toLong())
        editor.apply()
        
        Log.d(TAG, "Premium Synced | Features: $featureSet | Time: ${timestamp.toLong()}")
    }

    @ReactMethod
    fun syncBlockToNative(number: String, isBlocked: Boolean) {
        BlockDataBridge.syncBlockStatus(reactApplicationContext, number, isBlocked)
    }

    @ReactMethod
    fun isNumberBlockedNative(number: String, promise: Promise) {
        try {
            val status = BlockDataBridge.isNumberBlocked(reactApplicationContext, number)
            promise.resolve(status)
        } catch (e: Exception) {
            promise.reject("PREFS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun answerCall() { QCallInCallService.answerCurrentCall() }

    @ReactMethod
    fun endCall() { QCallInCallService.hangupCurrentCall() }

    @ReactMethod
    fun startCall(number: String) {
        val context = reactApplicationContext
        val uri = Uri.parse("tel:" + number.replace("#", "%23"))
        try {
            val tm = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            tm.placeCall(uri, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting call: ${e.message}")
        }
    }

    @ReactMethod
    fun setMuted(muted: Boolean) { QCallInCallService.instance?.setMuted(muted) }

    @ReactMethod
    fun setSpeakerphoneOn(on: Boolean) { QCallInCallService.toggleSpeaker(on) }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

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
    fun testIncomingOverlay(testNumber: String) {
        val context = reactApplicationContext
        try {
            val intent = Intent(context, CallerIdActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                putExtra("number", testNumber)
                putExtra("name", "Test Caller")
                putExtra("isAfterCall", false)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun testAfterCallOverlay(testNumber: String, durationInSeconds: Int) {
        val context = reactApplicationContext
        try {
            val intent = Intent(context, CallerIdActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                putExtra("number", testNumber)
                putExtra("name", "Test Caller")
                putExtra("isAfterCall", true)
                putExtra("duration", durationInSeconds)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun simulateIncomingNotification(name: String, number: String) {
        val context = reactApplicationContext
        NotificationHelper.showTestNotification(context, name, number)
    }

    @ReactMethod
    fun cancelIncomingNotification() {
        val context = reactApplicationContext
        NotificationHelper.cancelTestNotification(context)
    }

    @ReactMethod
    fun addListener(eventName: String) {}
    @ReactMethod
    fun removeListeners(count: Int) {}
}