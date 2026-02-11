package com.rkgroup.qcall

import android.app.Activity
import android.content.Intent
import android.provider.Telephony
import com.facebook.react.bridge.*

class DefaultSmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "DefaultSmsModule"
    }

    @ReactMethod
    fun isDefaultSmsApp(promise: Promise) {
        try {
            val context = reactApplicationContext
            val myPackage = context.packageName
            val defaultPackage = Telephony.Sms.getDefaultSmsPackage(context)
            // Returns true if QCall is currently the default SMS app
            promise.resolve(myPackage == defaultPackage)
        } catch (e: Exception) {
            promise.reject("ERROR", e)
        }
    }

    @ReactMethod
    fun requestDefaultSmsRole() {
        val context = reactApplicationContext
        val myPackage = context.packageName
        val defaultPackage = Telephony.Sms.getDefaultSmsPackage(context)

        if (myPackage != defaultPackage) {
            // Opens the system dialog to ask the user
            val intent = Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT)
            intent.putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, myPackage)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }
}