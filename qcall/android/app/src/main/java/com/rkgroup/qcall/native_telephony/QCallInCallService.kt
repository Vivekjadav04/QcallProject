package com.rkgroup.qcall.native_telephony

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.VideoProfile
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.rkgroup.qcall.CallManagerModule
import com.rkgroup.qcall.IncomingCallActivity
import com.rkgroup.qcall.OngoingCallActivity
import com.rkgroup.qcall.R
import java.io.InputStream

class QCallInCallService : InCallService() {

    companion object {
        const val CHANNEL_ID = "qcall_native_v18" // Bumped version to reset notification settings
        const val NOTIFICATION_ID = 999
        
        var currentCall: Call? = null
        var lastCallerName = "Unknown"
        var lastCallerNumber = ""
        var callStartTime: Long = 0 

        private var activeRingtone: Ringtone? = null
        var instance: QCallInCallService? = null

        fun stopRingtone() {
            try {
                if (activeRingtone?.isPlaying == true) {
                    activeRingtone?.stop()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun toggleSpeaker(enable: Boolean) {
            instance?.setAudioRoute(if (enable) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE)
        }
        
        fun answerCurrentCall() {
            currentCall?.answer(VideoProfile.STATE_AUDIO_ONLY)
        }
        
        fun hangupCurrentCall() {
            if (currentCall != null) {
                if (currentCall?.state == Call.STATE_RINGING) {
                    currentCall?.reject(false, null)
                } else {
                    currentCall?.disconnect()
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        stopRingtone()
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        currentCall = call
        
        val handle = call.details.handle
        val number = handle?.schemeSpecificPart ?: "Unknown"
        lastCallerNumber = number
        lastCallerName = getContactName(this, number)
        callStartTime = 0 

        // 🟢 INSTANT LAUNCH LOGIC
        if (call.state == Call.STATE_RINGING) {
            startRinging()
            launchIncomingUI() 
            showNotification(number, lastCallerName, true) 
            updateReactAndUI(Call.STATE_RINGING)
        } else {
            launchOngoingUI()
            showNotification(number, lastCallerName, false) 
        }

        call.registerCallback(callCallback)
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        stopRingtone()
        // Only clear if it matches to prevent race conditions
        if (currentCall == call) {
            currentCall = null
        }
        sendInternalBroadcast("ACTION_CALL_ENDED")
        updateReactAndUI(Call.STATE_DISCONNECTED)
        
        val nm = getSystemService(NotificationManager::class.java)
        nm.cancel(NOTIFICATION_ID)
    }

    private val callCallback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            updateReactAndUI(state)
            
            when (state) {
                Call.STATE_ACTIVE -> {
                    stopRingtone()
                    if (callStartTime == 0L) callStartTime = System.currentTimeMillis()
                    
                    sendInternalBroadcast("ACTION_CALL_ACTIVE")
                    // Update Notification: Switch to Ongoing Mode (1 Button)
                    showNotification(lastCallerNumber, lastCallerName, false) 
                }
                Call.STATE_DISCONNECTED -> {
                    stopRingtone()
                    callStartTime = 0
                    sendInternalBroadcast("ACTION_CALL_ENDED")
                    getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
                }
            }
        }
    }

    private fun launchIncomingUI() {
        val intent = Intent(this, IncomingCallActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or 
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or 
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or 
                        Intent.FLAG_ACTIVITY_NO_ANIMATION) // 🟢 Instant
        intent.putExtra("contact_number", lastCallerNumber)
        intent.putExtra("contact_name", lastCallerName)
        intent.putExtra("is_test_mode", false)
        startActivity(intent)
    }

    private fun launchOngoingUI() {
        val intent = Intent(this, OngoingCallActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or 
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or 
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or 
                        Intent.FLAG_ACTIVITY_NO_ANIMATION) // 🟢 Instant
        intent.putExtra("contact_number", lastCallerNumber)
        intent.putExtra("contact_name", lastCallerName)
        intent.putExtra("is_test_mode", false)
        startActivity(intent)
    }

    private fun startRinging() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            activeRingtone = RingtoneManager.getRingtone(applicationContext, uri)
            activeRingtone?.play()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // 🟢 UPDATED NOTIFICATION LOGIC
    private fun showNotification(number: String, name: String, isIncoming: Boolean) {
        createChannel()
        
        val displayName = if (name != "Unknown") name else number
        val statusText = if (isIncoming) "Incoming Call" else "Call in Progress"

        // Intents
        val targetClass = if (isIncoming) IncomingCallActivity::class.java else OngoingCallActivity::class.java
        val fullScreenIntent = Intent(this, targetClass).apply {
            putExtra("contact_name", name)
            putExtra("contact_number", number)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, fullScreenIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        // Setup Layout
        val customLayout = RemoteViews(packageName, R.layout.notification_custom)
        customLayout.setTextViewText(R.id.notif_name, displayName)
        customLayout.setTextViewText(R.id.notif_status, statusText)

        // 🟢 DYNAMIC PHOTO LOGIC
        val photo = loadContactPhoto(this, number)
        if (photo != null) {
            customLayout.setImageViewBitmap(R.id.notif_image, photo)
        } else {
            val letter = if (displayName.isNotEmpty()) displayName.take(1).uppercase() else "#"
            val letterBitmap = createLetterBitmap(letter)
            customLayout.setImageViewBitmap(R.id.notif_image, letterBitmap)
        }

        // 🟢 BUTTON VISIBILITY LOGIC
        if (isIncoming) {
            customLayout.setViewVisibility(R.id.container_accept, View.VISIBLE)
            val acceptIntent = Intent(this, NotificationActionReceiver::class.java).apply { action = "ACTION_ANSWER" }
            val acceptPending = PendingIntent.getBroadcast(this, 1, acceptIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            customLayout.setOnClickPendingIntent(R.id.notif_btn_accept, acceptPending)
        } else {
            customLayout.setViewVisibility(R.id.container_accept, View.GONE)
        }

        // Decline Always Visible
        val declineIntent = Intent(this, NotificationActionReceiver::class.java).apply { action = "ACTION_DECLINE" }
        val declinePending = PendingIntent.getBroadcast(this, 2, declineIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        customLayout.setOnClickPendingIntent(R.id.notif_btn_decline, declinePending)

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle()) // 🟢 Allows expansion
            .setCustomContentView(customLayout)     // Collapsed
            .setCustomBigContentView(customLayout)  // Expanded (Fixes cutting)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setFullScreenIntent(pendingIntent, true) // Pops up over screen
            .setContentIntent(pendingIntent)
            .setAutoCancel(false)

        startForeground(NOTIFICATION_ID, builder.build())
    }

    // 🟢 HELPER: Load Photo from Contacts
    private fun loadContactPhoto(context: Context, number: String): Bitmap? {
        if (number.isEmpty()) return null
        val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number))
        val cursor = context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup.PHOTO_URI), null, null, null)
        
        var bitmap: Bitmap? = null
        try {
            if (cursor != null && cursor.moveToFirst()) {
                val photoUriStr = cursor.getString(0)
                if (photoUriStr != null) {
                    val photoUri = Uri.parse(photoUriStr)
                    val inputStream: InputStream? = context.contentResolver.openInputStream(photoUri)
                    bitmap = BitmapFactory.decodeStream(inputStream)
                    inputStream?.close()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            cursor?.close()
        }
        return if (bitmap != null) getCircularBitmap(bitmap) else null
    }

    // 🟢 HELPER: Create Letter Bitmap (Fallback)
    private fun createLetterBitmap(letter: String): Bitmap {
        val size = 200
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        
        val paint = Paint()
        paint.color = Color.parseColor("#38BDF8") 
        paint.isAntiAlias = true
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
        
        paint.color = Color.WHITE
        paint.textSize = 100f
        paint.textAlign = Paint.Align.CENTER
        
        val bounds = Rect()
        paint.getTextBounds(letter, 0, letter.length, bounds)
        val yOffset = bounds.height() / 2
        
        canvas.drawText(letter, size / 2f, (size / 2f) + yOffset, paint)
        return bitmap
    }

    private fun getCircularBitmap(bitmap: Bitmap): Bitmap {
        val output = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint()
        val rect = Rect(0, 0, bitmap.width, bitmap.height)
        
        paint.isAntiAlias = true
        canvas.drawARGB(0, 0, 0, 0)
        paint.color = Color.WHITE
        canvas.drawCircle(bitmap.width / 2f, bitmap.height / 2f, bitmap.width / 2f, paint)
        
        paint.xfermode = android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.SRC_IN)
        canvas.drawBitmap(bitmap, rect, rect, paint)
        return output
    }

    private fun updateReactAndUI(state: Int) {
        val status = when (state) {
            Call.STATE_ACTIVE -> "Active"
            Call.STATE_RINGING -> "Incoming"
            Call.STATE_DISCONNECTED -> "Disconnected"
            Call.STATE_DIALING -> "Dialing"
            else -> "Unknown"
        }
        try {
            val params = Arguments.createMap()
            params.putString("status", status)
            CallManagerModule.sendEvent("onCallStateChanged", params)
        } catch (e: Exception) { }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(CHANNEL_ID, "Active Calls", NotificationManager.IMPORTANCE_HIGH)
            channel.setSound(null, null) 
            nm.createNotificationChannel(channel)
        }
    }
    
    private fun sendInternalBroadcast(action: String) {
        val intent = Intent(action)
        intent.setPackage(packageName)
        sendBroadcast(intent)
    }
    
    private fun getContactName(context: Context, phoneNumber: String?): String {
        if (phoneNumber.isNullOrEmpty()) return "Unknown"
        val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber))
        try {
            val cursor = context.contentResolver.query(uri, arrayOf(android.provider.ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)
            cursor?.use {
                if (it.moveToFirst()) return it.getString(0)
            }
        } catch (e: Exception) {}
        return "Unknown"
    }
}