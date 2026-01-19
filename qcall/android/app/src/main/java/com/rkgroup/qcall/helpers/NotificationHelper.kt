package com.rkgroup.qcall.helpers

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import com.rkgroup.qcall.CallActivity
import com.rkgroup.qcall.R
import com.rkgroup.qcall.native_telephony.NotificationActionReceiver

object NotificationHelper {

    const val NOTIFICATION_ID = 888
    const val CHANNEL_ID = "qcall_native_v21"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "QCall Service",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                setSound(null, null)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableVibration(true)
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    // 🟢 INCOMING CALL NOTIFICATION (Answer + Decline)
    fun createIncomingCallNotification(
        context: Context,
        callerName: String,
        callerNumber: String
    ): Notification {
        
        val customLayout = RemoteViews(context.packageName, R.layout.notification_custom)
        
        customLayout.setTextViewText(R.id.notif_name, callerName)
        customLayout.setTextViewText(R.id.notif_status, "Incoming Call...")
        
        // Ensure Answer button is visible
        customLayout.setViewVisibility(R.id.container_accept, View.VISIBLE)

        // 1. Answer Action
        val acceptIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_ANSWER" }
        val acceptPending = PendingIntent.getBroadcast(context, 1, acceptIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        customLayout.setOnClickPendingIntent(R.id.notif_btn_accept, acceptPending)

        // 2. Decline Action
        val declineIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
        val declinePending = PendingIntent.getBroadcast(context, 2, declineIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        customLayout.setOnClickPendingIntent(R.id.notif_btn_decline, declinePending)

        // 3. Full Screen Intent (Wakes Lock Screen)
        val fullScreenIntent = Intent(context, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT
            putExtra("contact_name", callerName)
            putExtra("contact_number", callerNumber)
            putExtra("call_status", "Incoming")
        }
        val fullScreenPending = PendingIntent.getActivity(context, 0, fullScreenIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(customLayout)
            .setCustomBigContentView(customLayout)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setFullScreenIntent(fullScreenPending, true)
            .setContentIntent(fullScreenPending)
            .setAutoCancel(false)
            .build()
    }

    // 🟢 ONGOING CALL NOTIFICATION (Hangup Only)
    fun createOngoingCallNotification(
        context: Context,
        callerName: String,
        callerNumber: String
    ): Notification {

        val customLayout = RemoteViews(context.packageName, R.layout.notification_custom)
        customLayout.setTextViewText(R.id.notif_name, callerName)
        customLayout.setTextViewText(R.id.notif_status, "Call in Progress")
        
        // Hide Answer Button
        customLayout.setViewVisibility(R.id.container_accept, View.GONE)

        // Decline/End Call Action
        val declineIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
        val declinePending = PendingIntent.getBroadcast(context, 2, declineIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        customLayout.setOnClickPendingIntent(R.id.notif_btn_decline, declinePending)

        // Tap opens Call Screen
        val intent = Intent(context, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT
            putExtra("call_status", "Active")
        }
        val pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(customLayout)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }
}