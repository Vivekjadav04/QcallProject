package com.rkgroup.qcall

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.ColorStateList
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.GridLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.rkgroup.qcall.helpers.ContactHelper
import com.rkgroup.qcall.native_telephony.QCallInCallService
import java.util.concurrent.TimeUnit

class CallActivity : Activity() {

    private val TAG = "CallActivity"

    // UI Layouts
    private lateinit var incomingLayout: RelativeLayout
    private lateinit var ongoingLayout: RelativeLayout

    // UI Components
    private lateinit var btnIncomingAnswer: ImageButton
    private lateinit var btnIncomingDecline: ImageButton
    private lateinit var btnEndCall: ImageButton
    private lateinit var btnMute: ImageView
    private lateinit var btnSpeaker: ImageView
    private lateinit var btnKeypad: ImageView
    private lateinit var txtMute: TextView
    private lateinit var txtSpeaker: TextView
    private lateinit var keypadContainer: GridLayout

    // State Variables
    private var isMuted = false
    private var isSpeaker = false
    private var isKeypadVisible = false
    private var isTimerRunning = false

    // Animations
    private var giggleAnswer: ObjectAnimator? = null
    private var giggleDecline: ObjectAnimator? = null

    // Call Duration Timer
    private val handler = Handler(Looper.getMainLooper())
    private val timerRunnable = object : Runnable {
        override fun run() {
            val startTime = QCallInCallService.callStartTime
            if (startTime > 0) {
                val millis = System.currentTimeMillis() - startTime
                val seconds = TimeUnit.MILLISECONDS.toSeconds(millis) % 60
                val minutes = TimeUnit.MILLISECONDS.toMinutes(millis)
                findViewById<TextView>(R.id.ongoingDuration).text = String.format("%02d:%02d", minutes, seconds)
            }
            handler.postDelayed(this, 1000)
        }
    }

    // Broadcast Receiver for updates from Service
    private val callStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action
            Log.d(TAG, "Broadcast Received: $action")
            if (action == "ACTION_CALL_ENDED") {
                finishAndRemoveTask()
            } else if (action == "ACTION_CALL_ACTIVE") {
                switchToOngoingUI(startTimerNow = true)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "onCreate Called")
        
        // 1. Setup Lock Screen Flags (Show even if locked)
        showOverLockScreen()
        
        setContentView(R.layout.activity_call)

        // 2. Edge-to-Edge Padding
        val rootView = findViewById<ViewGroup>(android.R.id.content).getChildAt(0)
        ViewCompat.setOnApplyWindowInsetsListener(rootView) { view, windowInsets ->
            val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            WindowInsetsCompat.CONSUMED
        }

        initializeViews()
        setupButtons()
        setupKeypad()
        
        // 3. Process the intent that started this activity
        processIntent(intent)
        
        registerCallReceiver()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        Log.d(TAG, "onNewIntent Called")
        setIntent(intent)
        processIntent(intent)
    }

    private fun processIntent(intent: Intent?) {
        if (intent == null) return
        val name = intent.getStringExtra("contact_name") ?: "Unknown"
        val number = intent.getStringExtra("contact_number") ?: ""
        val status = intent.getStringExtra("call_status") ?: "Incoming"
        
        // 🟢 FIX: Check for Auto Answer flag from Notification
        val shouldAutoAnswer = intent.getBooleanExtra("auto_answer", false)

        Log.d(TAG, "Processing Intent: Name=$name, Number=$number, Status=$status, AutoAnswer=$shouldAutoAnswer")

        // Update Text Views
        findViewById<TextView>(R.id.incomingCallerName).text = name
        findViewById<TextView>(R.id.incomingNumber).text = number
        findViewById<TextView>(R.id.ongoingCallerName).text = name
        findViewById<TextView>(R.id.ongoingCallerNumber).text = number

        // Load Photo
        loadContactInfo(number)

        // 🟢 HANDLE AUTO ANSWER (Fixes Crash)
        if (shouldAutoAnswer) {
            QCallInCallService.answerCurrentCall()
            switchToOngoingUI(true)
            dismissKeyguard()
            return // Stop here, don't run the switch below
        }

        // Switch UI based on state
        when (status) {
            "Incoming" -> {
                Log.d(TAG, "State: Incoming - Showing Giggling Buttons")
                incomingLayout.visibility = View.VISIBLE
                ongoingLayout.visibility = View.GONE
                startGiggleAnimation()
            }
            "Active" -> {
                Log.d(TAG, "State: Active - Showing Ongoing UI")
                switchToOngoingUI(true)
                dismissKeyguard() // Unlock if possible
            }
            "Dialing" -> {
                Log.d(TAG, "State: Dialing - Showing Ongoing UI (Outgoing Call)")
                switchToOngoingUI(false) // Don't start timer yet, wait for Active
                findViewById<TextView>(R.id.ongoingStatus).text = "Dialing..."
                dismissKeyguard() // We are making a call, so unlock
            }
        }
    }

    private fun initializeViews() {
        incomingLayout = findViewById(R.id.incomingRLView)
        ongoingLayout = findViewById(R.id.inProgressCallRLView)
        
        // Incoming Buttons
        btnIncomingAnswer = findViewById(R.id.btnIncomingAnswer)
        btnIncomingDecline = findViewById(R.id.btnIncomingDecline)

        // Ongoing Buttons
        btnEndCall = findViewById(R.id.btnEndCall)
        btnMute = findViewById(R.id.btnMute)
        btnSpeaker = findViewById(R.id.btnSpeaker)
        btnKeypad = findViewById(R.id.btnKeypad)
        txtMute = findViewById(R.id.txtMute)
        txtSpeaker = findViewById(R.id.txtSpeaker)
        keypadContainer = findViewById(R.id.keypadContainer)
    }

    private fun setupButtons() {
        // --- INCOMING SCREEN ACTIONS ---
        btnIncomingAnswer.setOnClickListener {
            Log.d(TAG, "User Tapped Answer")
            stopGiggleAnimation()
            QCallInCallService.answerCurrentCall()
            switchToOngoingUI(true)
            dismissKeyguard()
        }

        btnIncomingDecline.setOnClickListener {
            Log.d(TAG, "User Tapped Decline")
            stopGiggleAnimation()
            QCallInCallService.hangupCurrentCall()
            finishAndRemoveTask()
        }

        // --- ONGOING SCREEN ACTIONS ---
        btnEndCall.setOnClickListener {
            Log.d(TAG, "User Tapped End Call")
            QCallInCallService.hangupCurrentCall()
            finishAndRemoveTask()
        }

        btnMute.setOnClickListener {
            isMuted = !isMuted
            Log.d(TAG, "Mute Toggled: $isMuted")
            QCallInCallService.instance?.setMuted(isMuted)
            updateButtonState(btnMute, txtMute, isMuted, "Mute", "Unmute")
        }

        btnSpeaker.setOnClickListener {
            isSpeaker = !isSpeaker
            Log.d(TAG, "Speaker Toggled: $isSpeaker")
            QCallInCallService.toggleSpeaker(isSpeaker)
            updateButtonState(btnSpeaker, txtSpeaker, isSpeaker, "Speaker", "Speaker On")
        }

        btnKeypad.setOnClickListener {
            isKeypadVisible = !isKeypadVisible
            keypadContainer.visibility = if (isKeypadVisible) View.VISIBLE else View.GONE
        }
    }

    private fun updateButtonState(btn: ImageView, txt: TextView, isActive: Boolean, inactiveText: String, activeText: String) {
        if (isActive) {
            btn.setBackgroundResource(R.drawable.circle_bg_green) // Reusing green circle for active state or create a specific drawable
            btn.imageTintList = ColorStateList.valueOf(resources.getColor(android.R.color.white, null))
            txt.text = activeText
        } else {
            btn.setBackgroundResource(R.drawable.bg_glass_panel)
            btn.imageTintList = ColorStateList.valueOf(resources.getColor(android.R.color.white, null))
            txt.text = inactiveText
        }
    }

    // --- ANIMATION LOGIC (Giggling) ---
    private fun startGiggleAnimation() {
        if (giggleAnswer == null) {
            // Rotate from -5 to 5 degrees
            val pvhRotate = PropertyValuesHolder.ofFloat("rotation", -5f, 5f)
            val pvhScaleX = PropertyValuesHolder.ofFloat("scaleX", 1f, 1.1f) // Slight pulse
            val pvhScaleY = PropertyValuesHolder.ofFloat("scaleY", 1f, 1.1f)

            giggleAnswer = ObjectAnimator.ofPropertyValuesHolder(btnIncomingAnswer, pvhRotate, pvhScaleX, pvhScaleY).apply {
                duration = 500
                repeatCount = ObjectAnimator.INFINITE
                repeatMode = ObjectAnimator.REVERSE
                interpolator = AccelerateDecelerateInterpolator()
            }
            giggleDecline = ObjectAnimator.ofPropertyValuesHolder(btnIncomingDecline, pvhRotate, pvhScaleX, pvhScaleY).apply {
                duration = 500
                startDelay = 250 // Offset specifically so they wiggle out of sync
                repeatCount = ObjectAnimator.INFINITE
                repeatMode = ObjectAnimator.REVERSE
                interpolator = AccelerateDecelerateInterpolator()
            }
        }
        if (giggleAnswer?.isRunning == false) giggleAnswer?.start()
        if (giggleDecline?.isRunning == false) giggleDecline?.start()
    }

    private fun stopGiggleAnimation() {
        giggleAnswer?.cancel()
        giggleDecline?.cancel()
        // Reset view properties
        btnIncomingAnswer.rotation = 0f
        btnIncomingAnswer.scaleX = 1f; btnIncomingAnswer.scaleY = 1f
        btnIncomingDecline.rotation = 0f
        btnIncomingDecline.scaleX = 1f; btnIncomingDecline.scaleY = 1f
    }

    private fun setupKeypad() {
        val keys = listOf(R.id.key0, R.id.key1, R.id.key2, R.id.key3, R.id.key4, R.id.key5, 
                          R.id.key6, R.id.key7, R.id.key8, R.id.key9, R.id.keyStar, R.id.keyHash)
        val map = mapOf(R.id.key0 to '0', R.id.key1 to '1', R.id.key2 to '2', R.id.key3 to '3', 
                        R.id.key4 to '4', R.id.key5 to '5', R.id.key6 to '6', R.id.key7 to '7', 
                        R.id.key8 to '8', R.id.key9 to '9', R.id.keyStar to '*', R.id.keyHash to '#')
        
        for (id in keys) {
            findViewById<View>(id)?.setOnClickListener {
                val char = map[id]
                if (char != null) QCallInCallService.playDtmf(char)
            }
        }
    }

    private fun switchToOngoingUI(startTimerNow: Boolean) {
        runOnUiThread {
            stopGiggleAnimation()
            incomingLayout.visibility = View.GONE
            ongoingLayout.visibility = View.VISIBLE
            findViewById<TextView>(R.id.ongoingStatus).text = "Active Call"
            
            if (startTimerNow && !isTimerRunning) {
                isTimerRunning = true
                handler.post(timerRunnable)
            }
        }
    }

    private fun loadContactInfo(number: String) {
        Thread {
            val info = ContactHelper.getContactInfo(this, number)
            runOnUiThread {
                if (!info.isUnknown) {
                    findViewById<TextView>(R.id.incomingCallerName).text = info.name
                    findViewById<TextView>(R.id.ongoingCallerName).text = info.name
                }
                if (info.photo != null) {
                    findViewById<ImageView>(R.id.incomingProfilePic)?.setImageBitmap(info.photo)
                    findViewById<ImageView>(R.id.ongoingProfilePic)?.setImageBitmap(info.photo)
                }
            }
        }.start()
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        // NOTE: We do NOT dismiss keyguard here. We only dismiss it when the user ANSWERS.
    }

    private fun dismissKeyguard() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
        }
    }

    private fun registerCallReceiver() {
        val filter = IntentFilter().apply {
            addAction("ACTION_CALL_ENDED")
            addAction("ACTION_CALL_ACTIVE")
        }
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(callStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(callStateReceiver, filter)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopGiggleAnimation()
        handler.removeCallbacks(timerRunnable)
        try { unregisterReceiver(callStateReceiver) } catch (e: Exception) {}
    }
}