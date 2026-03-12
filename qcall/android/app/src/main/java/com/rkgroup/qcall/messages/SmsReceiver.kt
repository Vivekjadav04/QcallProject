package com.rkgroup.qcall.messages

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.ContactsContract
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.rkgroup.qcall.MainActivity
import com.rkgroup.qcall.R // Added to access your mipmap icon

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        
        if (action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION || action == Telephony.Sms.Intents.SMS_DELIVER_ACTION) {
            
            // 🚀 ANTI-DUPLICATE FIX: Prevent double-firing if we are the default app
            val isDefaultSmsApp = Telephony.Sms.getDefaultSmsPackage(context) == context.packageName
            if (isDefaultSmsApp && action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
                // If we are default, we will also receive SMS_DELIVER_ACTION. 
                // Ignore this generic one so we don't process the message twice!
                return
            }

            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            val dbHelper = SmsDatabaseHelper(context)
            val db = dbHelper.writableDatabase 
            
            for (sms in messages) {
                val sender = sms.displayOriginatingAddress ?: ""
                val body = sms.displayMessageBody ?: ""
                val timestamp = sms.timestampMillis
                val coreId = SmsDatabaseHelper.getCore10Digits(sender)

                // 1. Save to our Custom Shadow DB 
                dbHelper.insertMessage(db, coreId, sender, body, timestamp, 1)

                // 2. If we are the default app, WE are responsible for writing to the Android Master Database
                try {
                    if (isDefaultSmsApp) {
                        val values = ContentValues().apply {
                            put("address", sender); put("body", body); put("date", timestamp); put("type", 1); put("read", 0) 
                        }
                        context.contentResolver.insert(Uri.parse("content://sms/inbox"), values)
                    }
                } catch (e: Exception) { }

                // 3. Show standard push notification (NOW WITH DEEP LINKING)
                showNotification(context, sender, body, timestamp)

                // 4. Tell React Native UI to reload the chat
                try {
                    val reactInstanceManager = (context.applicationContext as ReactApplication).reactNativeHost.reactInstanceManager
                    val reactContext = reactInstanceManager.currentReactContext
                    if (reactContext != null) {
                        val params = Arguments.createMap()
                        params.putString("sender", sender)
                        params.putString("body", body)
                        params.putDouble("timestamp", timestamp.toDouble())
                        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("onSMSReceived", params)
                    }
                } catch (e: Exception) { }
            }
        }
    }

    private fun getContactDetails(context: Context, phoneNumber: String): Pair<String, Bitmap?> {
        var contactName = phoneNumber
        var avatarBitmap: Bitmap? = null
        try {
            val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber))
            val cursor = context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME, ContactsContract.PhoneLookup.PHOTO_URI), null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    contactName = it.getString(0) ?: phoneNumber
                    val photoUriStr = it.getString(1)
                    if (photoUriStr != null) {
                        val inputStream = context.contentResolver.openInputStream(Uri.parse(photoUriStr))
                        avatarBitmap = BitmapFactory.decodeStream(inputStream)
                        inputStream?.close()
                    }
                }
            }
        } catch (e: Exception) { }
        return Pair(contactName, avatarBitmap)
    }

    private fun showNotification(context: Context, sender: String, body: String, timestamp: Long) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "qcall_messages_channel"
        val (contactName, avatarBitmap) = getContactDetails(context, sender)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Incoming Messages", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Notifications for incoming SMS messages"
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // 🟢 1. CREATE THE DEEP LINK URL
        // We URL-encode the parameters just in case the name has weird characters
        val encodedSender = Uri.encode(sender)
        val encodedName = Uri.encode(contactName)
        val deepLinkUri = Uri.parse("qcall://chat?senderId=$encodedSender&senderName=$encodedName")

        // 🟢 2. CREATE THE WAKE-UP INTENT
        val clickIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = deepLinkUri // Attach the Deep Link URL
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        // 🟢 3. WRAP IT IN A PENDING INTENT
        val pendingIntent = PendingIntent.getActivity(
            context, 
            sender.hashCode(), // Unique ID so chats don't overwrite each other
            clickIntent, 
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // 🟢 4. BUILD THE NOTIFICATION
        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher) // Uses your beautiful blue Q Icon
            .setContentTitle(contactName)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true) // Clears the notification when tapped
            .setContentIntent(pendingIntent) // Adds the deep link tap action

        if (avatarBitmap != null) {
            builder.setLargeIcon(avatarBitmap)
        }
        
        notificationManager.notify(sender.hashCode(), builder.build())
    }
}