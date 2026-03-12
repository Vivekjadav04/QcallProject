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
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import com.rkgroup.qcall.CallActivity
import com.rkgroup.qcall.R
import com.rkgroup.qcall.native_telephony.NotificationActionReceiver

object NotificationHelper {

    // 🟢 CHANGED: Added "_v2" to force Android to create a fresh, silent channel
    const val CHANNEL_ID = "qcall_incoming_channel_v2"
    const val ONGOING_CHANNEL_ID = "qcall_ongoing_channel"
    const val NOTIFICATION_ID = 8888

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            
            val channel = NotificationChannel(CHANNEL_ID, "Incoming Calls", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Notifications for incoming calls"
                
                // CRITICAL FIX: Completely silent and still so QCallInCallService can take over
                setSound(null, null) 
                enableVibration(false)
                
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableLights(true)
                lightColor = Color.BLUE
            }

            val ongoingChannel = NotificationChannel(ONGOING_CHANNEL_ID, "Ongoing Calls", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Notifications for active calls"
                setSound(null, null)
                enableVibration(false)
            }

            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
            manager.createNotificationChannel(ongoingChannel)
        }
    }

    fun createIncomingCallNotification(context: Context, callerName: String, callerNumber: String, photo: Bitmap?): Notification {
        
        // 1. Fullscreen Intent (Wakes up the screen)
        val fullScreenIntent = Intent(context, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("contact_name", callerName)
            putExtra("contact_number", callerNumber)
            putExtra("call_status", "Incoming")
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            context, 123, fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 2. Answer Intent (Green Button)
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

        // 3. Decline Intent (Red Button)
        val declineIntent = Intent(context, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
        val declinePendingIntent = PendingIntent.getBroadcast(
            context, 101, declineIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 🟢 NEW: Create a "Person" object for the native CallStyle
        val callerIcon = if (photo != null) IconCompat.createWithBitmap(photo) else null
        val caller = Person.Builder()
            .setName(callerName.ifEmpty { callerNumber })
            .setIcon(callerIcon)
            .setImportant(true)
            .build()

        // 🟢 NEW: Build Notification using native CallStyle instead of RemoteViews
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher) // Replaced with your app icon
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true) 
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            // THIS is the magic line that creates the beautiful system-level UI
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declinePendingIntent, acceptPendingIntent))

        return builder.build()
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

        // 🟢 UPGRADED: Let's make the ongoing call notification use CallStyle too!
        val caller = Person.Builder()
            .setName(callerName.ifEmpty { callerNumber })
            .setImportant(true)
            .build()

        return NotificationCompat.Builder(context, ONGOING_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(caller, hangupPendingIntent))
            .build()
    }

    // ==========================================
    // REACT NATIVE TEST HELPERS
    // ==========================================
    fun showTestNotification(context: Context, name: String, number: String) {
        createNotificationChannel(context)
        val notification = createIncomingCallNotification(context, name, number, null)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    fun cancelTestNotification(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)
    }
}