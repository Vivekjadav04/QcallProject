package com.rkgroup.qcall

import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.ImageView
import android.widget.RelativeLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.rkgroup.qcall.native_telephony.QCallInCallService
import java.util.concurrent.TimeUnit

class CallActivity : Activity() {

    // Views
    private lateinit var incomingLayout: RelativeLayout
    private lateinit var ongoingLayout: RelativeLayout
    
    // Swipe Logic
    private lateinit var draggableButton: View
    private lateinit var arrowUp: ImageView
    private lateinit var arrowDown: ImageView
    private var initialY = 0f
    private var dY = 0f
    private var isButtonDragged = false

    // State
    private var isMuted = false
    private var isSpeaker = false
    private var isTimerRunning = false // 🟢 Track if timer is active
    
    // Timer
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var durationTv: TextView

    private val timerRunnable = object : Runnable {
        override fun run() {
            val startTime = QCallInCallService.callStartTime
            if (startTime > 0) {
                val millis = System.currentTimeMillis() - startTime
                val seconds = TimeUnit.MILLISECONDS.toSeconds(millis) % 60
                val minutes = TimeUnit.MILLISECONDS.toMinutes(millis)
                durationTv.text = String.format("%02d:%02d", minutes, seconds)
            }
            handler.postDelayed(this, 1000)
        }
    }

    private val callStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action
            if (action == "ACTION_CALL_ENDED") {
                finishAndRemoveTask()
            } else if (action == "ACTION_CALL_ACTIVE") {
                // 🟢 1. Call Answered! Now start the timer.
                switchToOngoingUI(startTimerNow = true)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        unlockScreen()

        WindowCompat.setDecorFitsSystemWindows(window, false)

        setContentView(R.layout.activity_call)

        // Handle Safe Area (Insets)
        val rootView = findViewById<ViewGroup>(android.R.id.content).getChildAt(0)
        ViewCompat.setOnApplyWindowInsetsListener(rootView) { view, windowInsets ->
            val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            WindowInsetsCompat.CONSUMED
        }

        // Bind Views
        incomingLayout = findViewById(R.id.incomingRLView)
        ongoingLayout = findViewById(R.id.inProgressCallRLView)
        draggableButton = findViewById(R.id.draggable_button)
        arrowUp = findViewById(R.id.arrow_up)
        arrowDown = findViewById(R.id.arrow_down)
        durationTv = findViewById(R.id.ongoingDuration)

        // Get Data from Intent
        val name = intent.getStringExtra("contact_name") ?: "Unknown"
        val number = intent.getStringExtra("contact_number") ?: ""
        val status = intent.getStringExtra("call_status") ?: "Incoming"

        // Set Text
        findViewById<TextView>(R.id.incomingCallerName).text = name
        findViewById<TextView>(R.id.incomingNumber).text = number
        findViewById<TextView>(R.id.ongoingCallerName).text = name
        findViewById<TextView>(R.id.ongoingCallerNumber).text = number

        // 🟢 2. Initial State Logic
        when (status) {
            "Dialing" -> {
                // Outgoing call. Show UI, but NO Timer yet.
                switchToOngoingUI(startTimerNow = false)
                durationTv.text = "Dialing..."
            }
            "Active" -> {
                // Already active (recovered state). Start Timer.
                switchToOngoingUI(startTimerNow = true)
            }
            else -> {
                // Incoming
                setupSwipeListener()
            }
        }

        setupButtons()
        registerCallReceiver()
    }

    private fun setupButtons() {
        // End Call
        findViewById<View>(R.id.btnEndCall).setOnClickListener {
            QCallInCallService.hangupCurrentCall()
            finish()
        }

        // Mute
        val btnMute = findViewById<ImageView>(R.id.btnMute)
        val txtMute = findViewById<TextView>(R.id.txtMute)
        btnMute.setOnClickListener {
            isMuted = !isMuted
            QCallInCallService.instance?.setMuted(isMuted)
            if (isMuted) {
                btnMute.setBackgroundResource(R.drawable.circle_bg_green)
                txtMute.text = "Unmute"
            } else {
                btnMute.setBackgroundResource(R.drawable.bg_glass_panel)
                txtMute.text = "Mute"
            }
        }

        // Speaker
        val btnSpeaker = findViewById<ImageView>(R.id.btnSpeaker)
        val txtSpeaker = findViewById<TextView>(R.id.txtSpeaker)
        btnSpeaker.setOnClickListener {
            isSpeaker = !isSpeaker
            QCallInCallService.toggleSpeaker(isSpeaker)
            if (isSpeaker) {
                btnSpeaker.setBackgroundResource(R.drawable.circle_bg_green)
                txtSpeaker.text = "Speaker On"
            } else {
                btnSpeaker.setBackgroundResource(R.drawable.bg_glass_panel)
                txtSpeaker.text = "Speaker"
            }
        }
    }

    private fun setupSwipeListener() {
        draggableButton.post {
            initialY = draggableButton.y
        }

        draggableButton.setOnTouchListener { view, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    dY = view.y - event.rawY
                    isButtonDragged = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val newY = event.rawY + dY
                    val diff = newY - initialY
                    
                    if (diff > -400 && diff < 400) {
                        view.y = newY
                        if (diff < -100) arrowUp.alpha = 0.5f 
                        if (diff > 100) arrowDown.alpha = 0.5f
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    val diff = view.y - initialY
                    if (diff < -250) {
                        QCallInCallService.answerCurrentCall()
                        // 🟢 When answered, call becomes active immediately
                        switchToOngoingUI(startTimerNow = true)
                    } else if (diff > 250) {
                        QCallInCallService.hangupCurrentCall()
                        finishAndRemoveTask()
                    } else {
                        view.animate().y(initialY).setDuration(200).start()
                        arrowUp.alpha = 1.0f
                        arrowDown.alpha = 1.0f
                    }
                    true
                }
                else -> false
            }
        }
    }

    // 🟢 3. Helper: Only start timer if requested
    private fun switchToOngoingUI(startTimerNow: Boolean) {
        runOnUiThread {
            incomingLayout.visibility = View.GONE
            ongoingLayout.visibility = View.VISIBLE
            
            if (startTimerNow && !isTimerRunning) {
                isTimerRunning = true
                handler.post(timerRunnable)
            }
        }
    }

    private fun registerCallReceiver() {
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

    private fun unlockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(timerRunnable)
        try { unregisterReceiver(callStateReceiver) } catch (e: Exception) {}
    }
}