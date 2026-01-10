package com.rkgroup.qcall.native_telephony

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
// 🟢 ADDED MISSING IMPORT:
import android.content.Context
import android.content.Intent
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.rkgroup.qcall.IncomingCallActivity
import com.rkgroup.qcall.OngoingCallActivity
import com.rkgroup.qcall.R

class QCallInCallService : InCallService() {

    companion object {
        const val CHANNEL_ID = "qcall_native_v10"
        const val NOTIFICATION_ID = 999
        var currentCall: Call? = null
        var lastCallerName = "Unknown"
        var lastCallerNumber = ""
        var callStartTime: Long = 0 

        private var activeRingtone: Ringtone? = null
        var instance: QCallInCallService? = null

        fun stopRingtone() {
            try { if (activeRingtone?.isPlaying == true) activeRingtone?.stop() } catch (e: Exception) {}
        }

        fun toggleSpeaker(enable: Boolean) {
            val service = instance ?: return
            service.setAudioRoute(if (enable) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE)
        }
    }

    override fun onCreate() { super.onCreate(); instance = this }
    override fun onDestroy() { super.onDestroy(); instance = null }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        currentCall = call
        val handle = call.details.handle
        val number = handle?.schemeSpecificPart ?: "Unknown"
        lastCallerNumber = number
        lastCallerName = getContactName(this, number)
        callStartTime = 0 // Reset timer

        if (call.state == Call.STATE_RINGING) {
            startRinging()
            showNotification(number, lastCallerName, true)
        } else {
            launchOngoingScreen(number, lastCallerName, "Dialing")
            showNotification(number, lastCallerName, false)
        }

        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                if (state == Call.STATE_ACTIVE) {
                    stopRingtone()
                    
                    if (callStartTime == 0L) callStartTime = System.currentTimeMillis()
                    
                    val intent = Intent("ACTION_CALL_ACTIVE")
                    LocalBroadcastManager.getInstance(applicationContext).sendBroadcast(intent)
                    
                    showNotification(lastCallerNumber, lastCallerName, false)
                } 
                else if (state == Call.STATE_DISCONNECTED) {
                    stopRingtone()
                    callStartTime = 0
                    val intent = Intent("ACTION_CALL_ENDED")
                    LocalBroadcastManager.getInstance(applicationContext).sendBroadcast(intent)
                    val nm = getSystemService(NotificationManager::class.java)
                    nm.cancel(NOTIFICATION_ID)
                }
            }
        })
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        stopRingtone()
        currentCall = null
        val intent = Intent("ACTION_CALL_ENDED")
        LocalBroadcastManager.getInstance(applicationContext).sendBroadcast(intent)
        val nm = getSystemService(NotificationManager::class.java)
        nm.cancel(NOTIFICATION_ID)
    }

    private fun launchOngoingScreen(number: String, name: String, status: String) {
        val intent = Intent(this, OngoingCallActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT) 
        intent.putExtra("CALLER_NAME", name)
        intent.putExtra("CALLER_NUMBER", number)
        intent.putExtra("STATUS", status)
        startActivity(intent)
    }

    private fun startRinging() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            activeRingtone = RingtoneManager.getRingtone(applicationContext, uri)
            activeRingtone?.play()
        } catch (e: Exception) {}
    }

    private fun showNotification(number: String, name: String, isIncoming: Boolean) {
        createChannel()
        
        val targetClass = if (isIncoming) IncomingCallActivity::class.java else OngoingCallActivity::class.java
        val fullScreenIntent = Intent(this, targetClass).apply {
            putExtra("CALLER_NAME", name)
            putExtra("CALLER_NUMBER", number)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, fullScreenIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        val customLayout = RemoteViews(packageName, R.layout.notification_custom)
        customLayout.setTextViewText(R.id.notif_name, if (name != "Unknown") name else number)
        customLayout.setTextViewText(R.id.notif_status, if (isIncoming) "Incoming Call" else "Call in Progress")

        if (isIncoming) {
            val acceptIntent = Intent(this, OngoingCallActivity::class.java).apply {
                putExtra("CALLER_NAME", name)
                putExtra("CALLER_NUMBER", number)
                putExtra("STATUS", "Active")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val acceptPending = PendingIntent.getActivity(this, 1, acceptIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            customLayout.setOnClickPendingIntent(R.id.notif_btn_accept, acceptPending)
        }
        
        val declineIntent = Intent(this, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
        val declinePending = PendingIntent.getBroadcast(this, 2, declineIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        customLayout.setOnClickPendingIntent(R.id.notif_btn_decline, declinePending)

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setCustomContentView(customLayout)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setFullScreenIntent(pendingIntent, true)
            .setContentIntent(pendingIntent)
            .setAutoCancel(false)

        startForeground(NOTIFICATION_ID, builder.build())
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_HIGH)
            channel.setSound(null, null)
            nm.createNotificationChannel(channel)
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