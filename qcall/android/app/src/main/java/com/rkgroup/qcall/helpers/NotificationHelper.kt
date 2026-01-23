package com.rkgroup.qcall.helpers

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import com.rkgroup.qcall.CallActivity
import com.rkgroup.qcall.R
import com.rkgroup.qcall.native_telephony.NotificationActionReceiver

object NotificationHelper {

    const val CHANNEL_ID = "qcall_incoming_channel"
    const val ONGOING_CHANNEL_ID = "qcall_ongoing_channel"
    const val NOTIFICATION_ID = 8888

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(CHANNEL_ID, "Incoming Calls", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Notifications for incoming calls"
                setSound(soundUri, attributes)
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            val ongoingChannel = NotificationChannel(ONGOING_CHANNEL_ID, "Ongoing Calls", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Notifications for active calls"
                setSound(null, null)
            }

            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
            manager.createNotificationChannel(ongoingChannel)
        }
    }

    fun createIncomingCallNotification(context: Context, callerName: String, callerNumber: String): Notification {
        val fullScreenIntent = Intent(context, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("contact_name", callerName)
            putExtra("contact_number", callerNumber)
            putExtra("call_status", "Incoming")
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            context, 123, fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val acceptIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_ANSWER" }
        val acceptPendingIntent = PendingIntent.getBroadcast(context, 100, acceptIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val declineIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
        val declinePendingIntent = PendingIntent.getBroadcast(context, 101, declineIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val customLayout = RemoteViews(context.packageName, R.layout.notification_custom)
        customLayout.setTextViewText(R.id.notif_name, callerName)
        customLayout.setTextViewText(R.id.notif_status, "Incoming Call...")
        customLayout.setOnClickPendingIntent(R.id.notif_btn_accept, acceptPendingIntent)
        customLayout.setOnClickPendingIntent(R.id.notif_btn_decline, declinePendingIntent)

        // FIX: Using system icon to avoid "Unresolved reference" error
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(customLayout)
            .setCustomHeadsUpContentView(customLayout)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .build()
    }

    fun createOngoingCallNotification(context: Context, callerName: String, callerNumber: String): Notification {
        val openIntent = Intent(context, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("call_status", "Active")
            putExtra("contact_name", callerName)
            putExtra("contact_number", callerNumber)
        }
        val pendingIntent = PendingIntent.getActivity(context, 456, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val hangupIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
        val hangupPendingIntent = PendingIntent.getBroadcast(context, 457, hangupIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        // FIX: Using system icon here as well
        return NotificationCompat.Builder(context, ONGOING_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle(callerName)
            .setContentText("Call in progress")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End Call", hangupPendingIntent)
            .build()
    }
}