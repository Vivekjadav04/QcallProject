package com.rkgroup.qcall

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.Button
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
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class CallActivity : Activity() {

    private val TAG = "CallActivity"
    private val SERVER_URL = "https://unintegrable-adalynn-uninvokable.ngrok-free.dev/api/contacts/identify"

    // UI Layouts
    private lateinit var rootLayout: RelativeLayout
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

    // Caller Data Views
    private lateinit var incomingCallerName: TextView
    private lateinit var incomingNumber: TextView
    private lateinit var incomingTitle: TextView
    private lateinit var incomingLocation: TextView
    private lateinit var incomingProfilePic: ImageView

    private lateinit var ongoingCallerName: TextView
    private lateinit var ongoingCallerNumber: TextView
    private lateinit var ongoingTitle: TextView
    private lateinit var ongoingStatus: TextView
    private lateinit var ongoingProfilePic: ImageView

    // State Variables
    private var isMuted = false
    private var isSpeaker = false
    private var isKeypadVisible = false
    private var isTimerRunning = false

    // Colors exactly like Truecaller
    private val COLOR_BLUE = Color.parseColor("#1C64F2")
    private val COLOR_RED = Color.parseColor("#DC2626")
    private val COLOR_GREEN = Color.parseColor("#10B981")
    private val COLOR_DARK_BG = Color.parseColor("#0F172A") // The bottom fade color

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
        
        showOverLockScreen()
        setContentView(R.layout.activity_call)

        val rootViewInsets = findViewById<ViewGroup>(android.R.id.content).getChildAt(0)
        ViewCompat.setOnApplyWindowInsetsListener(rootViewInsets) { view, windowInsets ->
            val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            WindowInsetsCompat.CONSUMED
        }

        initializeViews()
        setupButtons()
        setupKeypad()
        processIntent(intent)
        registerCallReceiver()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        processIntent(intent)
    }

    private fun processIntent(intent: Intent?) {
        if (intent == null) return
        val name = intent.getStringExtra("contact_name") ?: "Unknown Caller"
        val number = intent.getStringExtra("contact_number") ?: ""
        val status = intent.getStringExtra("call_status") ?: "Incoming"
        val shouldAutoAnswer = intent.getBooleanExtra("auto_answer", false)

        // Set initial Text
        incomingCallerName.text = name
        incomingNumber.text = number
        ongoingCallerName.text = name
        ongoingCallerNumber.text = number

        // 🟢 FEATURE CHECK: Check local user's Gold Status
        val sharedPref: SharedPreferences = getSharedPreferences("QcallPrefs", Context.MODE_PRIVATE)
        val allowedFeatures = sharedPref.getStringSet("allowedFeatures", emptySet()) ?: emptySet()
        val userHasGoldFeature = allowedFeatures.contains("golden_caller_id")

        // 🟢 IDENTIFY CALLER VIA NGROK & LOCAL DB
        identifyCaller(number, name, userHasGoldFeature)

        if (shouldAutoAnswer) {
            QCallInCallService.answerCurrentCall()
            switchToOngoingUI(true)
            dismissKeyguard()
            return
        }

        when (status) {
            "Incoming" -> {
                incomingLayout.visibility = View.VISIBLE
                ongoingLayout.visibility = View.GONE
                startGiggleAnimation()
            }
            "Active" -> {
                switchToOngoingUI(true)
                dismissKeyguard()
            }
            "Dialing" -> {
                switchToOngoingUI(false)
                ongoingStatus.text = "Dialing..."
                dismissKeyguard()
            }
        }
    }

    // 🟢 FETCH FROM SERVER (Same as CallerIdActivity)
    private fun identifyCaller(number: String, passedName: String, userHasGoldFeature: Boolean) {
        CoroutineScope(Dispatchers.IO).launch {
            val rawNum = number.replace(Regex("[^0-9]"), "")
            val last10 = if (rawNum.length >= 10) rawNum.takeLast(10) else rawNum
            
            // 1. Check local contacts
            val localInfo = ContactHelper.getContactInfo(this@CallActivity, number)
            var currentName = passedName
            var isSavedLocally = false

            if (!localInfo.isUnknown) {
                isSavedLocally = true
                currentName = localInfo.name
                withContext(Dispatchers.Main) {
                    updateTheme(currentName, localInfo.photo, isSpam = false, isPremium = false, isVerified = false, isSaved = true, forceGold = userHasGoldFeature)
                }
            }

            // 2. Check Server
            var result: ServerResult? = fetchFromServer("91$last10")
            if (result == null || !result.found) result = fetchFromServer(last10)

            withContext(Dispatchers.Main) {
                if (result != null && result.found) {
                    val finalName = if (isSavedLocally) currentName else (result.name ?: currentName)
                    updateTheme(
                        name = finalName,
                        photoBitmap = if (isSavedLocally) localInfo.photo else result.bitmap,
                        isSpam = result.isSpam,
                        isPremium = result.isPremiumUser,
                        isVerified = result.isVerifiedUser,
                        isSaved = isSavedLocally,
                        forceGold = userHasGoldFeature
                    )
                } else if (!isSavedLocally) {
                    updateTheme(currentName, null, isSpam = false, isPremium = false, isVerified = false, isSaved = false, forceGold = userHasGoldFeature)
                }
            }
        }
    }

    // 🟢 APPLY DYNAMIC GRADIENTS
    private fun updateTheme(name: String, photoBitmap: Bitmap?, isSpam: Boolean, isPremium: Boolean, isVerified: Boolean, isSaved: Boolean, forceGold: Boolean) {
        incomingCallerName.text = name
        ongoingCallerName.text = name

        if (photoBitmap != null) {
            incomingProfilePic.setImageBitmap(photoBitmap)
            ongoingProfilePic.setImageBitmap(photoBitmap)
        }

        when {
            isSpam -> applySolidGradientTheme(COLOR_RED, "Likely Spam", Color.WHITE)
            isPremium || forceGold -> applyShinyGoldTheme("👑 Premium Gold")
            isVerified -> applySolidGradientTheme(COLOR_GREEN, "Verified QCall User", Color.WHITE)
            else -> applySolidGradientTheme(COLOR_BLUE, if(isSaved) "Saved Contact" else "Incoming Call", Color.WHITE)
        }
    }

    // Gradient from Solid Color at Top to Dark at Bottom
    private fun applySolidGradientTheme(topColor: Int, statusText: String, textColor: Int) {
        val gradient = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(topColor, COLOR_DARK_BG)
        )
        rootLayout.background = gradient

        // Update Text Status
        incomingTitle.text = statusText
        incomingLocation.text = if (statusText == "Likely Spam") "SPAM CALL DETECTED" else "Mobile"
        ongoingTitle.text = statusText

        // Ensure text is readable
        setTextColor(textColor, Color.parseColor("#E0E0E0"))
    }

    // Truecaller Shiny Gold Gradient
    private fun applyShinyGoldTheme(statusText: String) {
        val goldColors = intArrayOf(
            Color.parseColor("#E1C470"), // Light Gold
            Color.parseColor("#FBE493"), // Bright Gold Glare
            Color.parseColor("#15110A")  // Very Dark bottom to match your slider
        )
        val gradient = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, goldColors)
        rootLayout.background = gradient

        incomingTitle.text = statusText
        incomingLocation.text = "QCall Gold Member"
        ongoingTitle.text = statusText

        // Dark text for the top gold section
        val darkBrown = Color.parseColor("#2C271E")
        val fadedBrown = Color.parseColor("#5A5243")
        setTextColor(darkBrown, fadedBrown)
    }

    private fun setTextColor(mainColor: Int, subColor: Int) {
        incomingCallerName.setTextColor(mainColor)
        incomingTitle.setTextColor(subColor)
        incomingNumber.setTextColor(subColor)
        incomingLocation.setTextColor(subColor)
        
        ongoingCallerName.setTextColor(mainColor)
        ongoingTitle.setTextColor(subColor)
        ongoingCallerNumber.setTextColor(subColor)
    }

    private fun fetchFromServer(queryNumber: String): ServerResult? {
        try {
            val url = URL("$SERVER_URL?number=$queryNumber")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 3000
            
            if (connection.responseCode == 200) {
                val stream = connection.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(stream)
                
                if (json.optBoolean("found", false)) {
                    val name = json.optString("name", "Unknown")
                    val photoBase64 = json.optString("photo", "")
                    var apiBitmap: Bitmap? = null
                    if (photoBase64.isNotEmpty()) {
                        try {
                            val decodedString = Base64.decode(photoBase64, Base64.DEFAULT)
                            apiBitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.size)
                        } catch (e: Exception) {}
                    }
                    return ServerResult(
                        found = true, name = name,
                        isSpam = json.optBoolean("isSpam", false),
                        isPremiumUser = json.optBoolean("isPremium", false),
                        isVerifiedUser = json.optBoolean("isVerified", false),
                        bitmap = apiBitmap
                    )
                }
            }
        } catch (e: Exception) { Log.e(TAG, "Fetch Error", e) }
        return ServerResult(false, null, false, false, false, null)
    }

    data class ServerResult(val found: Boolean, val name: String?, val isSpam: Boolean, val isPremiumUser: Boolean, val isVerifiedUser: Boolean, val bitmap: Bitmap?)

    private fun initializeViews() {
        rootLayout = findViewById(R.id.rootLayout)
        incomingLayout = findViewById(R.id.incomingRLView)
        ongoingLayout = findViewById(R.id.inProgressCallRLView)
        
        btnIncomingAnswer = findViewById(R.id.btnIncomingAnswer)
        btnIncomingDecline = findViewById(R.id.btnIncomingDecline)

        btnEndCall = findViewById(R.id.btnEndCall)
        btnMute = findViewById(R.id.btnMute)
        btnSpeaker = findViewById(R.id.btnSpeaker)
        btnKeypad = findViewById(R.id.btnKeypad)
        txtMute = findViewById(R.id.txtMute)
        txtSpeaker = findViewById(R.id.txtSpeaker)
        keypadContainer = findViewById(R.id.keypadContainer)

        incomingCallerName = findViewById(R.id.incomingCallerName)
        incomingNumber = findViewById(R.id.incomingNumber)
        incomingTitle = findViewById(R.id.incomingTitle)
        incomingLocation = findViewById(R.id.incomingLocation)
        incomingProfilePic = findViewById(R.id.incomingProfilePic)

        ongoingCallerName = findViewById(R.id.ongoingCallerName)
        ongoingCallerNumber = findViewById(R.id.ongoingCallerNumber)
        ongoingTitle = findViewById(R.id.ongoingTitle)
        ongoingStatus = findViewById(R.id.ongoingStatus)
        ongoingProfilePic = findViewById(R.id.ongoingProfilePic)
    }

    // --- REMAINDER OF YOUR EXISTING FUNCTIONS ---
    private fun setupButtons() {
        btnIncomingAnswer.setOnClickListener {
            stopGiggleAnimation()
            QCallInCallService.answerCurrentCall()
            switchToOngoingUI(true)
            dismissKeyguard()
        }
        btnIncomingDecline.setOnClickListener {
            stopGiggleAnimation()
            QCallInCallService.hangupCurrentCall()
            finishAndRemoveTask()
        }
        btnEndCall.setOnClickListener {
            QCallInCallService.hangupCurrentCall()
            finishAndRemoveTask()
        }
        btnMute.setOnClickListener {
            isMuted = !isMuted
            QCallInCallService.instance?.setMuted(isMuted)
            updateButtonState(btnMute, txtMute, isMuted, "Mute", "Unmute")
        }
        btnSpeaker.setOnClickListener {
            isSpeaker = !isSpeaker
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
            btn.setBackgroundResource(R.drawable.circle_bg_green)
            btn.imageTintList = ColorStateList.valueOf(resources.getColor(android.R.color.white, null))
            txt.text = activeText
        } else {
            btn.setBackgroundResource(R.drawable.bg_glass_panel)
            btn.imageTintList = ColorStateList.valueOf(resources.getColor(android.R.color.white, null))
            txt.text = inactiveText
        }
    }

    private fun startGiggleAnimation() {
        if (giggleAnswer == null) {
            val pvhRotate = PropertyValuesHolder.ofFloat("rotation", -5f, 5f)
            val pvhScaleX = PropertyValuesHolder.ofFloat("scaleX", 1f, 1.1f)
            val pvhScaleY = PropertyValuesHolder.ofFloat("scaleY", 1f, 1.1f)

            giggleAnswer = ObjectAnimator.ofPropertyValuesHolder(btnIncomingAnswer, pvhRotate, pvhScaleX, pvhScaleY).apply {
                duration = 500; repeatCount = ObjectAnimator.INFINITE; repeatMode = ObjectAnimator.REVERSE; interpolator = AccelerateDecelerateInterpolator()
            }
            giggleDecline = ObjectAnimator.ofPropertyValuesHolder(btnIncomingDecline, pvhRotate, pvhScaleX, pvhScaleY).apply {
                duration = 500; startDelay = 250; repeatCount = ObjectAnimator.INFINITE; repeatMode = ObjectAnimator.REVERSE; interpolator = AccelerateDecelerateInterpolator()
            }
        }
        if (giggleAnswer?.isRunning == false) giggleAnswer?.start()
        if (giggleDecline?.isRunning == false) giggleDecline?.start()
    }

    private fun stopGiggleAnimation() {
        giggleAnswer?.cancel()
        giggleDecline?.cancel()
        btnIncomingAnswer.rotation = 0f; btnIncomingAnswer.scaleX = 1f; btnIncomingAnswer.scaleY = 1f
        btnIncomingDecline.rotation = 0f; btnIncomingDecline.scaleX = 1f; btnIncomingDecline.scaleY = 1f
    }

    private fun setupKeypad() {
        val keys = listOf(R.id.key0, R.id.key1, R.id.key2, R.id.key3, R.id.key4, R.id.key5, R.id.key6, R.id.key7, R.id.key8, R.id.key9, R.id.keyStar, R.id.keyHash)
        val map = mapOf(R.id.key0 to '0', R.id.key1 to '1', R.id.key2 to '2', R.id.key3 to '3', R.id.key4 to '4', R.id.key5 to '5', R.id.key6 to '6', R.id.key7 to '7', R.id.key8 to '8', R.id.key9 to '9', R.id.keyStar to '*', R.id.keyHash to '#')
        for (id in keys) {
            findViewById<View>(id)?.setOnClickListener { char -> map[id]?.let { QCallInCallService.playDtmf(it) } }
        }
    }

    private fun switchToOngoingUI(startTimerNow: Boolean) {
        runOnUiThread {
            stopGiggleAnimation()
            incomingLayout.visibility = View.GONE
            ongoingLayout.visibility = View.VISIBLE
            ongoingStatus.text = "Active Call"
            if (startTimerNow && !isTimerRunning) {
                isTimerRunning = true
                handler.post(timerRunnable)
            }
        }
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
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
        val filter = IntentFilter().apply { addAction("ACTION_CALL_ENDED"); addAction("ACTION_CALL_ACTIVE") }
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