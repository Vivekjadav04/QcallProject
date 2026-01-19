package com.rkgroup.qcall

import android.animation.ObjectAnimator
import android.annotation.SuppressLint
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
import android.view.animation.AnimationUtils
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.rkgroup.qcall.native_telephony.QCallInCallService
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

class CallActivity : Activity() {

    // Layouts
    private lateinit var incomingLayout: RelativeLayout
    private lateinit var ongoingLayout: RelativeLayout

    // Draggable Button Logic (Ported from Reference)
    private lateinit var draggableButton: LinearLayout
    private lateinit var arrowUp: ImageView
    private lateinit var arrowDown: ImageView
    private lateinit var actionBtn: ImageView
    
    private var initialY = 0f
    private var dY = 0f
    private var isButtonDragged = false
    private var topLimit = 0f
    private var bottomLimit = 0f
    private var shinyAnimator: ObjectAnimator? = null

    // In-Progress Views
    private lateinit var btnEndCall: ImageButton
    private lateinit var btnMute: ImageView
    private lateinit var btnSpeaker: ImageView
    private lateinit var txtMute: TextView
    private lateinit var txtSpeaker: TextView
    private lateinit var tvDuration: TextView

    // State
    private var isMuted = false
    private var isSpeaker = false
    private var isTimerRunning = false
    
    private val handler = Handler(Looper.getMainLooper())
    private val timerRunnable = object : Runnable {
        override fun run() {
            val startTime = QCallInCallService.callStartTime
            if (startTime > 0) {
                val millis = System.currentTimeMillis() - startTime
                val seconds = TimeUnit.MILLISECONDS.toSeconds(millis) % 60
                val minutes = TimeUnit.MILLISECONDS.toMinutes(millis)
                tvDuration.text = String.format("%02d:%02d", minutes, seconds)
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
                switchToOngoingUI(startTimerNow = true)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        unlockScreen()
        setContentView(R.layout.activity_call)

        // Handle Full Screen
        val rootView = findViewById<ViewGroup>(android.R.id.content).getChildAt(0)
        ViewCompat.setOnApplyWindowInsetsListener(rootView) { view, windowInsets ->
            val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            WindowInsetsCompat.CONSUMED
        }

        initViews()
        
        // Handle Intent Data
        val name = intent.getStringExtra("contact_name") ?: "Unknown"
        val number = intent.getStringExtra("contact_number") ?: ""
        val status = intent.getStringExtra("call_status") ?: "Incoming"

        findViewById<TextView>(R.id.incomingCallerName).text = name
        findViewById<TextView>(R.id.incomingNumber).text = number
        findViewById<TextView>(R.id.ongoingCallerName).text = name
        findViewById<TextView>(R.id.ongoingCallerNumber).text = number

        // Initial State
        when (status) {
            "Dialing" -> {
                switchToOngoingUI(startTimerNow = false)
                tvDuration.text = "Dialing..."
            }
            "Active" -> {
                switchToOngoingUI(startTimerNow = true)
            }
            else -> {
                incomingLayout.visibility = View.VISIBLE
                ongoingLayout.visibility = View.GONE
                setupDraggableButton() // Enable the slider only for incoming
            }
        }

        setupButtons()
        registerCallReceiver()
    }

    private fun initViews() {
        incomingLayout = findViewById(R.id.incomingRLView)
        ongoingLayout = findViewById(R.id.inProgressCallRLView)
        
        draggableButton = findViewById(R.id.draggable_button)
        arrowUp = findViewById(R.id.arrow_up)
        arrowDown = findViewById(R.id.arrow_down)
        actionBtn = findViewById(R.id.actionBtn)
        
        btnEndCall = findViewById(R.id.btnEndCall)
        btnMute = findViewById(R.id.btnMute)
        btnSpeaker = findViewById(R.id.btnSpeaker)
        txtMute = findViewById(R.id.txtMute)
        txtSpeaker = findViewById(R.id.txtSpeaker)
        tvDuration = findViewById(R.id.ongoingDuration)
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupDraggableButton() {
        // Animation for Arrow Up (Shiny Effect)
        shinyAnimator = ObjectAnimator.ofFloat(arrowUp, "alpha", 0f, 1f).apply {
            duration = 800
            repeatMode = ObjectAnimator.REVERSE
            repeatCount = ObjectAnimator.INFINITE
            start()
        }

        draggableButton.post {
            initialY = draggableButton.y
            // Set Limits based on container height
            topLimit = (findViewById<View>(R.id.draggable_button_container).height / 2 - 300).toFloat() // Approximate based on XML
            bottomLimit = initialY + 250
        }

        draggableButton.setOnTouchListener { view, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    dY = view.y - event.rawY
                    isButtonDragged = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    var newY = event.rawY + dY
                    // Clamp Movement
                    // Simplified clamping for demo; ensures it stays within rough bounds
                    if(newY < initialY - 200) newY = initialY - 200
                    if(newY > initialY + 200) newY = initialY + 200

                    view.y = newY
                    
                    // Move arrows slightly to indicate interaction
                    arrowUp.alpha = if (newY < initialY) 0.3f else 1.0f
                    arrowDown.alpha = if (newY > initialY) 0.3f else 1.0f

                    isButtonDragged = true
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (isButtonDragged) {
                        val diff = view.y - initialY
                        
                        if (diff < -150) { 
                            // DRAGGED UP -> ANSWER
                            QCallInCallService.answerCurrentCall()
                            switchToOngoingUI(startTimerNow = true)
                        } else if (diff > 150) {
                            // DRAGGED DOWN -> DECLINE
                            QCallInCallService.hangupCurrentCall()
                            finishAndRemoveTask()
                        } else {
                            // SNAP BACK
                            view.animate().y(initialY).setDuration(300).start()
                            arrowUp.alpha = 1.0f
                            arrowDown.alpha = 1.0f
                        }
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun setupButtons() {
        btnEndCall.setOnClickListener {
            QCallInCallService.hangupCurrentCall()
            finishAndRemoveTask()
        }

        btnMute.setOnClickListener {
            isMuted = !isMuted
            QCallInCallService.instance?.setMuted(isMuted)
            if (isMuted) {
                btnMute.setBackgroundResource(R.drawable.bg_glass_panel) // Change if you have 'filled' drawable
                btnMute.alpha = 0.5f
                txtMute.text = "Unmute"
            } else {
                btnMute.setBackgroundResource(R.drawable.bg_glass_panel)
                btnMute.alpha = 1.0f
                txtMute.text = "Mute"
            }
        }

        btnSpeaker.setOnClickListener {
            isSpeaker = !isSpeaker
            QCallInCallService.toggleSpeaker(isSpeaker)
            if (isSpeaker) {
                btnSpeaker.alpha = 1.0f
                txtSpeaker.text = "Speaker On"
            } else {
                btnSpeaker.alpha = 0.5f
                txtSpeaker.text = "Speaker"
            }
        }
    }

    private fun switchToOngoingUI(startTimerNow: Boolean) {
        runOnUiThread {
            incomingLayout.visibility = View.GONE
            ongoingLayout.visibility = View.VISIBLE
            shinyAnimator?.cancel()
            
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