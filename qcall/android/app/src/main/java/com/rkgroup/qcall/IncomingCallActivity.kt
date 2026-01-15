package com.rkgroup.qcall

import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.TextView
import androidx.cardview.widget.CardView
import com.rkgroup.qcall.native_telephony.QCallInCallService
import com.rkgroup.qcall.OngoingCallActivity // 🟢 Ensure this import matches your file name

class IncomingCallActivity : Activity() {

    // Receiver to finish activity if call ends remotely
    private val callEndReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "ACTION_CALL_ENDED") {
                finishAndRemoveTask()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        unlockScreen() // Ensure screen wakes up
        setContentView(R.layout.activity_incoming_call)

        // 1. Get Data (Support both key formats just in case)
        val name = intent.getStringExtra("contact_name") ?: intent.getStringExtra("CALLER_NAME") ?: "Unknown"
        val number = intent.getStringExtra("contact_number") ?: intent.getStringExtra("CALLER_NUMBER") ?: ""
        val isTestMode = intent.getBooleanExtra("is_test_mode", false)

        findViewById<TextView>(R.id.incomingCallerNameTV).text = name
        findViewById<TextView>(R.id.incomingCallerPhoneNumberTV).text = number

        // 2. DECLINE Button Logic
        findViewById<CardView>(R.id.endCallBtn).setOnClickListener {
            if (isTestMode) {
                // Just close screen in test mode
                finishAndRemoveTask()
            } else {
                QCallInCallService.hangupCurrentCall()
                finishAndRemoveTask()
            }
        }

        // 3. ACCEPT Button Logic
        findViewById<CardView>(R.id.draggable_button).setOnClickListener {
            
            // Only call the native answer function if it's NOT a test
            if (!isTestMode) {
                QCallInCallService.answerCurrentCall()
            }

            // 🟢 Launch Ongoing Screen Instantly
            val ongoingIntent = Intent(this, OngoingCallActivity::class.java).apply {
                putExtra("contact_name", name)
                putExtra("contact_number", number)
                putExtra("call_status", "Active")
                // Pass test mode forward so Ongoing screen behaves correctly too
                putExtra("is_test_mode", isTestMode)
                
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            }
            startActivity(ongoingIntent)
            
            finish() // Close this Incoming Screen
        }
    }

    override fun onStart() {
        super.onStart()
        // Register Receiver (Standard Broadcast)
        val filter = IntentFilter("ACTION_CALL_ENDED")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(callEndReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(callEndReceiver, filter)
        }
    }

    override fun onStop() {
        super.onStop()
        try {
            unregisterReceiver(callEndReceiver)
        } catch (e: Exception) {
            // Receiver might not be registered
        }
    }

    private fun unlockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        
        // Keyguard Dismiss logic
        val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        keyguardManager.requestDismissKeyguard(this, null)

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
    }
}