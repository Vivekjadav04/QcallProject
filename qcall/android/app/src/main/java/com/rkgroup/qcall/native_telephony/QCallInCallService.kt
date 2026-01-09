package com.rkgroup.qcall.native_telephony

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.telecom.Call
import android.telecom.InCallService
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.rkgroup.qcall.CallManagerModule
import com.rkgroup.qcall.MainActivity
import com.rkgroup.qcall.R

class QCallInCallService : InCallService() {

    private val TAG = "QCallService"

    companion object {
        // 🟢 UPDATED CHANNEL ID: Forces Android to reset sound settings
        const val CHANNEL_ID = "qcall_ringing_channel_v3"
        const val NOTIFICATION_ID = 888
        
        // 🟢 PUBLIC ACCESS: Critical for CallManagerModule to work
        var currentCall: Call? = null
        var lastCallerName: String = "Unknown"
        var lastCallerNumber: String = ""
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        currentCall = call
        
        val handle = call.details.handle
        val number = handle?.schemeSpecificPart ?: "Unknown"

        try {
            lastCallerName = getContactName(this, number)
            lastCallerNumber = number
        } catch (e: Exception) {
            lastCallerName = "Unknown"
        }

        val params = Arguments.createMap()
        params.putString("number", number)
        params.putString("name", lastCallerName)

        if (call.state == Call.STATE_RINGING) {
            params.putString("status", "Incoming")
            showNotification(number, lastCallerName, true)
        } else {
            params.putString("status", "Dialing")
            // 🟢 FORCE APP FRONT (Uses Deep Link for Speed)
            bringAppToForeground(number, lastCallerName)
            showNotification(number, lastCallerName, false)
        }
        
        CallManagerModule.sendEvent("onCallStateChanged", params)

        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                val updateParams = Arguments.createMap()
                when (state) {
                    Call.STATE_ACTIVE -> {
                        updateParams.putString("status", "Active")
                        CallManagerModule.sendEvent("onCallStateChanged", updateParams)
                    }
                    Call.STATE_DISCONNECTED -> {
                        updateParams.putString("status", "Disconnected")
                        CallManagerModule.sendEvent("onCallStateChanged", updateParams)
                        removeNotification()
                        currentCall = null // Cleanup
                    }
                }
            }
        })
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        currentCall = null
        removeNotification()
        val params = Arguments.createMap()
        params.putString("status", "Disconnected")
        CallManagerModule.sendEvent("onCallStateChanged", params)
    }

    // 🟢 UPDATED: Uses Deep Link URI for INSTANT UI detection in Expo Router
    private fun bringAppToForeground(number: String, name: String) {
        try {
            val safeName = Uri.encode(name)
            val safeNumber = Uri.encode(number)
            
            // Deep Link directly to outgoing screen
            val deepLink = Uri.parse("qcall://outgoing?number=$safeNumber&name=$safeName&status=Dialing")

            val intent = Intent(Intent.ACTION_VIEW, deepLink, this, MainActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error forcing app to front: ${e.message}")
        }
    }

    private fun removeNotification() {
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(NOTIFICATION_ID)
        } catch (e: Exception) {}
    }

    private fun showNotification(number: String, name: String, isIncoming: Boolean) {
        createNotificationChannel()
        
        // 🟢 UPDATED: Deep Link intent for Notification Tap
        val safeName = Uri.encode(name)
        val safeNumber = Uri.encode(number)
        val route = if (isIncoming) "incoming" else "outgoing"
        val status = if (isIncoming) "Incoming" else "Dialing"
        
        val deepLink = Uri.parse("qcall://$route?number=$safeNumber&name=$safeName&status=$status")
        
        val intent = Intent(Intent.ACTION_VIEW, deepLink, this, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(if (name != "Unknown") name else number)
            .setContentText(if (isIncoming) "Incoming Call" else "Call in progress")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .setAutoCancel(false)

        // 🟢 ADD SOUND & VIBRATION
        if (isIncoming) {
            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            builder.setSound(soundUri)
            builder.setVibrate(longArrayOf(0, 1000, 500, 1000))

            val acceptIntent = Intent(this, NotificationActionReceiver::class.java).apply { action = "ACTION_ACCEPT" }
            val acceptPending = PendingIntent.getBroadcast(this, 1, acceptIntent, PendingIntent.FLAG_IMMUTABLE)
            val declineIntent = Intent(this, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
            val declinePending = PendingIntent.getBroadcast(this, 2, declineIntent, PendingIntent.FLAG_IMMUTABLE)
            
            builder.addAction(android.R.drawable.ic_menu_call, "Accept", acceptPending)
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePending)
        }

        startForeground(NOTIFICATION_ID, builder.build())
    }

    // 🟢 UPDATED: Forces Ringtone Audio Attributes
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(CHANNEL_ID, "Incoming Calls", NotificationManager.IMPORTANCE_HIGH)
                
                // Set Sound Attributes correctly
                val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()

                channel.setSound(soundUri, audioAttributes)
                channel.enableVibration(true)
                channel.vibrationPattern = longArrayOf(0, 1000, 500, 1000)
                channel.lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                
                nm.createNotificationChannel(channel)
            }
        }
    }

    private fun getContactName(context: Context, phoneNumber: String?): String {
        if (phoneNumber.isNullOrEmpty()) return "Unknown"
        val uri = Uri.withAppendedPath(android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber))
        try {
            val cursor = context.contentResolver.query(uri, arrayOf(android.provider.ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)
            cursor?.use {
                if (it.moveToFirst()) return it.getString(0)
            }
        } catch (e: Exception) {}
        return "Unknown"
    }
}