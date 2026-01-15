package com.rkgroup.qcall

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log // 🟢 Added for Debugging
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.rkgroup.qcall.native_telephony.QCallInCallService
import java.util.concurrent.TimeUnit
import com.rkgroup.qcall.R

class OngoingCallActivity : Activity() {

    private val TAG = "OngoingCallActivity"
    private lateinit var statusTv: TextView
    private var isMuted = false
    private var isSpeaker = false
    private var isTestMode = false
    
    // For Test Mode Simulation
    private var testStartTime: Long = 0

    // Timer Logic
    private val handler = Handler(Looper.getMainLooper())
    private val timerRunnable = object : Runnable {
        override fun run() {
            // 1. DETERMINE START TIME (Real Service vs Test Mode)
            val startTime = if (isTestMode) testStartTime else QCallInCallService.callStartTime
            
            if (startTime > 0) {
                // ACTIVE STATE (Green Timer)
                val millis = System.currentTimeMillis() - startTime
                val seconds = TimeUnit.MILLISECONDS.toSeconds(millis) % 60
                val minutes = TimeUnit.MILLISECONDS.toMinutes(millis)
                
                statusTv.text = String.format("%02d:%02d", minutes, seconds)
                statusTv.setTextColor(Color.parseColor("#69F0AE")) // Neon Green
            } else {
                // DIALING STATE (Lemon Text)
                statusTv.text = "Dialing..."
                statusTv.setTextColor(Color.parseColor("#FFF9C4")) // Lemon Yellow
            }
            handler.postDelayed(this, 1000)
        }
    }

    private val callStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "ACTION_CALL_ENDED") {
                Log.d(TAG, "Received ACTION_CALL_ENDED. Closing screen.")
                finishAndRemoveTask()
            } else if (intent?.action == "ACTION_CALL_ACTIVE") {
                // Real call connected logic
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        unlockScreen()
        setContentView(R.layout.activity_ongoing_call) 

        statusTv = findViewById(R.id.callStatus)
        val nameTv = findViewById<TextView>(R.id.callerName)
        val numberTv = findViewById<TextView>(R.id.callerNumber)

        // Support keys from CallManagerModule
        val name = intent.getStringExtra("contact_name") ?: intent.getStringExtra("CALLER_NAME") ?: "Unknown"
        val number = intent.getStringExtra("contact_number") ?: intent.getStringExtra("CALLER_NUMBER") ?: ""
        isTestMode = intent.getBooleanExtra("is_test_mode", false)

        nameTv.text = name
        numberTv.text = number
        
        // Handle Test Mode Simulation
        if (isTestMode) {
            handler.postDelayed({
                testStartTime = System.currentTimeMillis()
            }, 2000)
        }

        // Start Timer Loop
        handler.post(timerRunnable)

        // --- BUTTONS ---
        
        // 🟢 1. HANGUP BUTTON FIX
        // We use 'findViewById<View>' to be safe with ImageButton or CardView
        findViewById<View>(R.id.endOngoingCallBtn).setOnClickListener {
            Log.d(TAG, "End Call Button Pressed") // Debug Log
            
            if (!isTestMode) {
                // Execute Hangup
                QCallInCallService.hangupCurrentCall()
            }
            // Close UI immediately
            finishAndRemoveTask()
        }

        // 🟢 2. MUTE BUTTON LOGIC
        val btnMute = findViewById<View>(R.id.bgMute)
        
        btnMute.setOnClickListener {
            isMuted = !isMuted
            
            if (isMuted) {
                // Use your new drawables
                btnMute.setBackgroundResource(R.drawable.bg_circle_btn_active) 
            } else {
                btnMute.setBackgroundResource(R.drawable.btn_glass_circle)
            }
            // Add logic: CallManagerModule.setMuted(isMuted)
        }

        // 🟢 3. SPEAKER BUTTON LOGIC
        val btnSpeaker = findViewById<View>(R.id.bgSpeaker)
        
        btnSpeaker.setOnClickListener {
            isSpeaker = !isSpeaker
            
            if (!isTestMode) {
                QCallInCallService.toggleSpeaker(isSpeaker)
            }
            
            if (isSpeaker) {
                btnSpeaker.setBackgroundResource(R.drawable.bg_circle_btn_active)
            } else {
                btnSpeaker.setBackgroundResource(R.drawable.btn_glass_circle)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter().apply {
            addAction("ACTION_CALL_ENDED")
            addAction("ACTION_CALL_ACTIVE")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(callStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(callStateReceiver, filter)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(timerRunnable)
        try {
            unregisterReceiver(callStateReceiver)
        } catch (e: Exception) { }
    }

    private fun unlockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or 
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or 
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
    }
}