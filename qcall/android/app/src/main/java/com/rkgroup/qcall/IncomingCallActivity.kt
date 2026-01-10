package com.rkgroup.qcall

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.telecom.VideoProfile
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.rkgroup.qcall.native_telephony.QCallInCallService
import com.rkgroup.qcall.R

class IncomingCallActivity : Activity() {

    private val callEndReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "ACTION_CALL_ENDED") finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        unlockScreen()
        setContentView(R.layout.activity_incoming_call)

        val name = intent.getStringExtra("CALLER_NAME") ?: "Unknown"
        val number = intent.getStringExtra("CALLER_NUMBER") ?: ""

        findViewById<TextView>(R.id.incomingCallerNameTV).text = name
        findViewById<TextView>(R.id.incomingCallerPhoneNumberTV).text = number

        // DECLINE
        findViewById<View>(R.id.endCallBtn).setOnClickListener {
            QCallInCallService.stopRingtone()
            QCallInCallService.currentCall?.disconnect()
            finish()
        }

        // ACCEPT -> OPEN ONGOING SCREEN
        findViewById<View>(R.id.draggable_button).setOnClickListener {
            QCallInCallService.stopRingtone()
            QCallInCallService.currentCall?.answer(VideoProfile.STATE_AUDIO_ONLY)

            // 🟢 Launch Native Ongoing Screen Instantly
            val ongoingIntent = Intent(this, OngoingCallActivity::class.java)
            ongoingIntent.putExtra("CALLER_NAME", name)
            ongoingIntent.putExtra("CALLER_NUMBER", number)
            ongoingIntent.putExtra("STATUS", "Active")
            startActivity(ongoingIntent)
            
            finish() // Close Incoming Screen
        }

        LocalBroadcastManager.getInstance(this).registerReceiver(callEndReceiver, IntentFilter("ACTION_CALL_ENDED"))
    }

    override fun onDestroy() {
        super.onDestroy()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(callEndReceiver)
    }

    private fun unlockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
    }
}