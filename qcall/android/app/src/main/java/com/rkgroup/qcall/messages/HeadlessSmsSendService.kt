package com.rkgroup.qcall.messages

import android.app.Service
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.telephony.SmsManager
import android.telephony.TelephonyManager
import android.util.Log

class HeadlessSmsSendService : Service() {

    private val TAG = "HeadlessSmsService"

    override fun onBind(intent: Intent?): IBinder? {
        return null // We don't bind to this service, it just runs and dies
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == TelephonyManager.ACTION_RESPOND_VIA_MESSAGE) {
            val message = intent.getStringExtra(Intent.EXTRA_TEXT)
            val appUri: Uri? = intent.data

            if (message != null && appUri != null) {
                val destinationNumber = Uri.decode(appUri.schemeSpecificPart)
                sendSmsInBg(destinationNumber, message)
            }
        }
        
        // Stop the service as soon as the work is done
        stopSelf(startId)
        return START_NOT_STICKY
    }

    private fun sendSmsInBg(phoneNumber: String, message: String) {
        try {
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                applicationContext.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(message)
            if (parts.size > 1) {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            } else {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null)
            }
            Log.d(TAG, "Headless SMS sent successfully to $phoneNumber")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send Headless SMS", e)
        }
    }
}