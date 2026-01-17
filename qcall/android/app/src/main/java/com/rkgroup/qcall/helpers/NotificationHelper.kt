package com.rkgroup.qcall.helpers

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import com.rkgroup.qcall.CallActivity
import com.rkgroup.qcall.R
import com.rkgroup.qcall.native_telephony.NotificationActionReceiver

object NotificationHelper {

    const val NOTIFICATION_ID = 888
    const val CHANNEL_ID = "qcall_native_v21"

    // 🟢 1. Create the Channel (Run this once)
    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "QCall Service",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                setSound(null, null) // We play ringtone manually
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    // 🟢 2. Build Incoming Notification (Heads-up)
    fun createIncomingCallNotification(
        context: Context,
        callerName: String,
        callerNumber: String
    ): Notification {
        
        // Custom Layout
        val customLayout = RemoteViews(context.packageName, R.layout.notification_custom)
        customLayout.setTextViewText(R.id.notif_name, callerName)
        customLayout.setTextViewText(R.id.notif_status, "Incoming Call...")
        customLayout.setViewVisibility(R.id.container_accept, android.view.View.VISIBLE)

        // Intents for Buttons
        val acceptIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_ANSWER" }
        val acceptPending = PendingIntent.getBroadcast(context, 1, acceptIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        customLayout.setOnClickPendingIntent(R.id.notif_btn_accept, acceptPending)

        val declineIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
        val declinePending = PendingIntent.getBroadcast(context, 2, declineIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        customLayout.setOnClickPendingIntent(R.id.notif_btn_decline, declinePending)

        // Full Screen Intent (Wakes Lock Screen)
        val fullScreenIntent = Intent(context, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT
            putExtra("contact_name", callerName)
            putExtra("contact_number", callerNumber)
            putExtra("call_status", "Incoming")
        }
        val fullScreenPending = PendingIntent.getActivity(context, 0, fullScreenIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        // Build
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
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

        return builder.build()
    }

    // 🟢 3. Build Ongoing Notification (Active Call)
    fun createOngoingCallNotification(
        context: Context,
        callerName: String,
        callerNumber: String
    ): Notification {

        val customLayout = RemoteViews(context.packageName, R.layout.notification_custom)
        customLayout.setTextViewText(R.id.notif_name, callerName)
        customLayout.setTextViewText(R.id.notif_status, "Call in Progress")
        customLayout.setViewVisibility(R.id.container_accept, android.view.View.GONE) // Hide Answer button

        // End Call Button
        val declineIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
        val declinePending = PendingIntent.getBroadcast(context, 2, declineIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        customLayout.setOnClickPendingIntent(R.id.notif_btn_decline, declinePending)

        // Tap opens App
        val intent = Intent(context, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT
            putExtra("call_status", "Active")
        }
        val pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(customLayout)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setOngoing(true)
            .setContentIntent(pendingIntent)

        return builder.build()
    }
}