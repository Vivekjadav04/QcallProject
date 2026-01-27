package com.rkgroup.qcall.helpers

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
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
            
            val channel = NotificationChannel(CHANNEL_ID, "Incoming Calls", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Notifications for incoming calls"
                setSound(null, null) 
                enableVibration(true)
                // Pattern: 0ms delay, 1000ms vibrate, 500ms sleep
                vibrationPattern = longArrayOf(0, 1000, 500, 1000) 
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableLights(true)
                lightColor = Color.BLUE
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

    fun createIncomingCallNotification(context: Context, callerName: String, callerNumber: String, photo: Bitmap?): Notification {
        
        // 1. Fullscreen Intent
        val fullScreenIntent = Intent(context, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("contact_name", callerName)
            putExtra("contact_number", callerNumber)
            putExtra("call_status", "Incoming")
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            context, 123, fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 2. Answer Intent
        val acceptIntent = Intent(context, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("call_status", "Active") 
            putExtra("auto_answer", true)      
            putExtra("contact_name", callerName)
            putExtra("contact_number", callerNumber)
        }
        val acceptPendingIntent = PendingIntent.getActivity(
            context, 100, acceptIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 3. Decline Intent
        val declineIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
        val declinePendingIntent = PendingIntent.getBroadcast(
            context, 101, declineIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Custom Layout
        val customLayout = RemoteViews(context.packageName, R.layout.notification_custom)
        customLayout.setTextViewText(R.id.notif_name, callerName)
        customLayout.setTextViewText(R.id.notif_status, "Incoming Call...")
        
        if (photo != null) {
            customLayout.setImageViewBitmap(R.id.notif_image, photo)
        } else {
            customLayout.setImageViewResource(R.id.notif_image, android.R.drawable.sym_def_app_icon)
        }
        
        customLayout.setOnClickPendingIntent(R.id.notif_btn_accept, acceptPendingIntent)
        customLayout.setOnClickPendingIntent(R.id.notif_btn_decline, declinePendingIntent)

        // Build Notification
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(customLayout)
            .setCustomHeadsUpContentView(customLayout)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true) 
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)

        // 🟢 FIX: Set Insistent Flag Manually (Continuous Ringing)
        val notification = builder.build()
        notification.flags = notification.flags or Notification.FLAG_INSISTENT
        
        return notification
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