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
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.rkgroup.qcall.native_telephony.QCallInCallService
import java.util.concurrent.TimeUnit
import com.rkgroup.qcall.R

class OngoingCallActivity : Activity() {

    private lateinit var statusTv: TextView
    private var isMuted = false
    private var isSpeaker = false
    
    // Timer Logic
    private val handler = Handler(Looper.getMainLooper())
    private val timerRunnable = object : Runnable {
        override fun run() {
            // 🟢 CALCULATE TIME BASED ON SERVICE START TIME
            val startTime = QCallInCallService.callStartTime
            if (startTime > 0) {
                val millis = System.currentTimeMillis() - startTime
                val seconds = TimeUnit.MILLISECONDS.toSeconds(millis) % 60
                val minutes = TimeUnit.MILLISECONDS.toMinutes(millis)
                statusTv.text = String.format("%02d:%02d", minutes, seconds)
                statusTv.setTextColor(Color.parseColor("#80D8FF")) // Cyan for active
            } else {
                statusTv.text = "Dialing..."
            }
            handler.postDelayed(this, 1000)
        }
    }

    private val callStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "ACTION_CALL_ENDED") {
                finish()
            } else if (intent?.action == "ACTION_CALL_ACTIVE") {
                // 🟢 Call Connected! Timer updates automatically via runnable
                statusTv.text = "00:00"
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

        nameTv.text = intent.getStringExtra("CALLER_NAME") ?: "Unknown"
        numberTv.text = intent.getStringExtra("CALLER_NUMBER") ?: ""
        
        // 🟢 Start Timer Loop (It checks Service time constantly)
        handler.post(timerRunnable)

        // --- BUTTONS ---
        findViewById<View>(R.id.endOngoingCallBtn).setOnClickListener {
            QCallInCallService.currentCall?.disconnect()
            finish()
        }

        // Mute
        val btnMute = findViewById<View>(R.id.btnMute)
        val bgMute = findViewById<CardView>(R.id.bgMute)
        val iconMute = findViewById<ImageView>(R.id.iconMute)
        btnMute.setOnClickListener {
            isMuted = !isMuted
            // Logic handled if needed via Service
            if (isMuted) {
                bgMute.setCardBackgroundColor(Color.WHITE)
                iconMute.setColorFilter(Color.parseColor("#0056D2"))
            } else {
                bgMute.setCardBackgroundColor(Color.parseColor("#20FFFFFF"))
                iconMute.setColorFilter(Color.WHITE)
            }
        }

        // Speaker
        val btnSpeaker = findViewById<View>(R.id.btnSpeaker)
        val bgSpeaker = findViewById<CardView>(R.id.bgSpeaker)
        val iconSpeaker = findViewById<ImageView>(R.id.iconSpeaker)
        btnSpeaker.setOnClickListener {
            isSpeaker = !isSpeaker
            QCallInCallService.toggleSpeaker(isSpeaker)
            if (isSpeaker) {
                bgSpeaker.setCardBackgroundColor(Color.WHITE)
                iconSpeaker.setColorFilter(Color.parseColor("#0056D2"))
            } else {
                bgSpeaker.setCardBackgroundColor(Color.parseColor("#20FFFFFF"))
                iconSpeaker.setColorFilter(Color.WHITE)
            }
        }
        
        val filter = IntentFilter().apply {
            addAction("ACTION_CALL_ENDED")
            addAction("ACTION_CALL_ACTIVE")
        }
        LocalBroadcastManager.getInstance(this).registerReceiver(callStateReceiver, filter)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(timerRunnable)
        LocalBroadcastManager.getInstance(this).unregisterReceiver(callStateReceiver)
    }

    override fun onResume() {
        super.onResume()
        // 🟢 Ensure timer is synced when returning from background
        handler.post(timerRunnable)
    }

    private fun unlockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
}