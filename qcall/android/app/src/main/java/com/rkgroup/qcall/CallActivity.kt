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
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.RenderEffect
import android.graphics.Shader
import android.graphics.drawable.GradientDrawable
import android.net.Uri 
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.CallAudioState
import android.telecom.TelecomManager
import android.util.Base64
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.widget.Button
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.cardview.widget.CardView
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.rkgroup.qcall.helpers.ContactHelper
import com.rkgroup.qcall.native_telephony.QCallInCallService
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import kotlin.math.abs

class CallActivity : Activity() {

    private val TAG = "CallActivity"
    private val SERVER_URL = "https://unintegrable-adalynn-uninvokable.ngrok-free.dev/api/contacts/identify"

    private lateinit var rootLayout: RelativeLayout
    private lateinit var incomingLayout: RelativeLayout
    private lateinit var ongoingLayout: RelativeLayout
    private lateinit var bgBlurredImage: ImageView

    private lateinit var btnEndCall: ImageButton
    private lateinit var btnMute: ImageView
    private lateinit var btnKeypadToggle: ImageView
    private lateinit var btnAudioRoute: ImageView
    private lateinit var btnHold: ImageView
    private lateinit var btnAddCall: ImageView
    private lateinit var btnContacts: ImageView
    
    private lateinit var txtMute: TextView
    private lateinit var txtAudioRoute: TextView
    private lateinit var txtHold: TextView
    private lateinit var txtAddCall: TextView
    
    private lateinit var swipeTrack: CardView
    private lateinit var btnSwipeThumb: ImageView
    private lateinit var swipeColorCircle: View
    private lateinit var swipeHintText: TextView
    private var isSwipePulseRunning = false

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

    private var isMuted = false
    private var isHold = false
    private var isTimerRunning = false
    private var currentAudioRoute = "Earpiece" 
    private var dtmfString = "" 
    private var keypadSheet: BottomSheetDialog? = null

    private var isBtAvailable = false
    private var currentBtDeviceName = "Bluetooth"

    // Colors
    private val COLOR_SAFE_BLUE = Color.parseColor("#332196F3")
    private val COLOR_SPAM_RED = Color.parseColor("#33FF5252")
    private val COLOR_VERIFIED_GREEN = Color.parseColor("#334CAF50")
    private val TINT_GREEN = Color.parseColor("#4CAF50")
    private val TINT_RED = Color.parseColor("#FF5252")
    private val TINT_DEFAULT = Color.parseColor("#0F172A")
    private val COLOR_DARK_BG = Color.parseColor("#000000") 

    private var fetchJob: Job? = null

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
            when (intent?.action) {
                "ACTION_CALL_ENDED" -> finishAndRemoveTask()
                "ACTION_CALL_ACTIVE" -> switchToOngoingUI(startTimerNow = true)
                "ACTION_AUDIO_ROUTE_CHANGED" -> {
                    val route = intent.getIntExtra("audioRoute", CallAudioState.ROUTE_EARPIECE)
                    isBtAvailable = intent.getBooleanExtra("isBtAvailable", false)
                    currentBtDeviceName = intent.getStringExtra("btDeviceName") ?: "Bluetooth"
                    updateAudioUIFromNative(route, currentBtDeviceName)
                }
                "ACTION_CALL_COUNT_CHANGED" -> {
                    updateMultiCallUI()
                }
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
            view.setPadding(0, insets.top, 0, insets.bottom) 
            WindowInsetsCompat.CONSUMED
        }

        initializeViews()
        setupSwipeToAnswer()
        setupOngoingControls()
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

        incomingCallerName.text = name
        incomingNumber.text = number
        ongoingCallerName.text = name
        ongoingCallerNumber.text = number

        identifyCaller(number, name)
        
        updateMultiCallUI()
        QCallInCallService.currentAudioState?.route?.let { updateAudioUIFromNative(it) }

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
                startThumbPulse()
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

    private fun identifyCaller(number: String, passedName: String) {
        fetchJob?.cancel() 
        
        fetchJob = CoroutineScope(Dispatchers.IO).launch {
            val rawNum = number.replace(Regex("[^0-9]"), "")
            val last10 = if (rawNum.length >= 10) rawNum.takeLast(10) else rawNum
            
            val localJob = async { ContactHelper.getContactInfo(this@CallActivity, number) }
            val serverJob = async { 
                var res = fetchFromServer("91$last10")
                if (res == null || !res.found) res = fetchFromServer(last10)
                res
            }

            val localInfo = localJob.await()
            val result = serverJob.await()

            var currentName = passedName
            var isSavedLocally = false
            var photoToUse: Bitmap? = null

            if (!localInfo.isUnknown) {
                isSavedLocally = true
                currentName = localInfo.name
                photoToUse = localInfo.photo
            }

            if (result != null && result.found) {
                if (!isSavedLocally) {
                    currentName = result.name ?: currentName
                }
                
                if (photoToUse == null && result.bitmap != null) {
                    photoToUse = result.bitmap
                } else if (!isSavedLocally) {
                    photoToUse = result.bitmap
                }

                if (isActive) {
                    withContext(Dispatchers.Main) {
                        updateTheme(
                            name = currentName, 
                            photoBitmap = photoToUse, 
                            isSpam = result.isSpam, 
                            isPremium = result.isPremiumUser,
                            isVerified = result.isVerifiedUser, 
                            isSaved = isSavedLocally
                        )
                    }
                }
            } else {
                if (isActive) {
                    withContext(Dispatchers.Main) {
                        updateTheme(
                            name = currentName, 
                            photoBitmap = photoToUse, 
                            isSpam = false, 
                            isPremium = false, 
                            isVerified = false, 
                            isSaved = isSavedLocally
                        )
                    }
                }
            }
        }
    }

    private fun updateTheme(name: String, photoBitmap: Bitmap?, isSpam: Boolean, isPremium: Boolean, isVerified: Boolean, isSaved: Boolean) {
        incomingCallerName.text = name
        ongoingCallerName.text = name
        
        if (photoBitmap != null) {
            incomingProfilePic.setImageBitmap(photoBitmap)
            ongoingProfilePic.setImageBitmap(photoBitmap)
            bgBlurredImage.setImageBitmap(photoBitmap) 
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                bgBlurredImage.setRenderEffect(RenderEffect.createBlurEffect(100f, 100f, Shader.TileMode.MIRROR))
            }
        } else {
            bgBlurredImage.setImageResource(android.R.color.transparent)
        }

        when {
            isPremium -> {
                val spamWarn = if(isSpam) " (Spam Warning)" else ""
                applyShinyGoldTheme("👑 Premium Gold$spamWarn")
            }
            isSpam -> applySolidGradientTheme(COLOR_SPAM_RED, "Spam Detected", Color.WHITE)
            isVerified -> applySolidGradientTheme(COLOR_VERIFIED_GREEN, "Verified QCall User", Color.WHITE)
            else -> applySolidGradientTheme(COLOR_SAFE_BLUE, if(isSaved) "Saved Contact" else "Incoming Call", Color.WHITE)
        }
    }

    private fun applySolidGradientTheme(topColor: Int, statusText: String, textColor: Int) {
        val gradient = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(topColor, COLOR_DARK_BG))
        if(bgBlurredImage.drawable == null) rootLayout.background = gradient
        incomingTitle.text = statusText
        incomingLocation.text = if (statusText == "Spam Detected") "Likely Fraud/Telemarketer" else "Mobile"
        ongoingTitle.text = statusText
        setTextColor(textColor, Color.parseColor("#E0E0E0"))
    }

    private fun applyShinyGoldTheme(statusText: String) {
        val goldColors = intArrayOf(Color.parseColor("#CCFBE493"), Color.parseColor("#CC996515"), COLOR_DARK_BG)
        val gradient = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, goldColors)
        if(bgBlurredImage.drawable == null) rootLayout.background = gradient
        incomingTitle.text = statusText
        incomingLocation.text = "QCall Premium Member"
        ongoingTitle.text = statusText
        setTextColor(Color.WHITE, Color.parseColor("#FBE493"))
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
            connection.readTimeout = 3000
            
            if (connection.responseCode == 200) {
                val stream = connection.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(stream)
                
                val isFound = json.optBoolean("found", false) || json.optString("found") == "true"
                
                if (isFound) {
                    val name = json.optString("name", "Unknown")
                    val isSpam = json.optBoolean("isSpam", false) || json.optString("isSpam") == "true"
                    
                    val isPremiumUser = json.optBoolean("isPremium", false) 
                        || json.optBoolean("premium", false) 
                        || json.optString("isPremium") == "true"
                        || json.optString("premium") == "true"

                    val isVerifiedUser = json.optBoolean("isVerified", false) || json.optString("isVerified") == "true"

                    val photoBase64 = json.optString("photo", "")
                    var apiBitmap: Bitmap? = null
                    if (photoBase64.isNotEmpty()) {
                        try {
                            val decodedString = Base64.decode(photoBase64, Base64.DEFAULT)
                            apiBitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.size)
                        } catch (e: Exception) {}
                    }
                    return ServerResult(true, name, isSpam, isPremiumUser, isVerifiedUser, apiBitmap)
                }
            }
        } catch (e: Exception) { Log.e(TAG, "Fetch Error", e) }
        return null
    }

    data class ServerResult(val found: Boolean, val name: String?, val isSpam: Boolean, val isPremiumUser: Boolean, val isVerifiedUser: Boolean, val bitmap: Bitmap?)

    private fun initializeViews() {
        rootLayout = findViewById(R.id.rootLayout)
        incomingLayout = findViewById(R.id.incomingRLView)
        ongoingLayout = findViewById(R.id.inProgressCallRLView)
        bgBlurredImage = findViewById(R.id.bgBlurredImage)
        
        swipeTrack = findViewById(R.id.swipeTrack)
        btnSwipeThumb = findViewById(R.id.btnSwipeThumb)
        swipeColorCircle = findViewById(R.id.swipeColorCircle)
        swipeHintText = findViewById(R.id.swipeHintText)

        btnEndCall = findViewById(R.id.btnEndCall)
        btnMute = findViewById(R.id.btnMute)
        btnAudioRoute = findViewById(R.id.btnAudioRoute)
        btnKeypadToggle = findViewById(R.id.btnKeypadToggle)
        btnHold = findViewById(R.id.btnHold)
        btnAddCall = findViewById(R.id.btnAddCall)
        btnContacts = findViewById(R.id.btnContacts)
        
        txtMute = findViewById(R.id.txtMute)
        txtAudioRoute = findViewById(R.id.txtAudioRoute)
        txtHold = findViewById(R.id.txtHold)
        txtAddCall = findViewById(R.id.txtAddCall)

        txtAddCall = rootLayout.findViewWithTag("txtAddCall") as? TextView ?: findViewById(R.id.txtMute) 

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

    private fun setupSwipeToAnswer() {
        var initialX = 0f
        var maxDragDistance = 0f

        swipeTrack.post {
            maxDragDistance = (swipeTrack.width / 2f) - (btnSwipeThumb.width / 2f) - 10f
        }

        btnSwipeThumb.setOnTouchListener { view, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = event.rawX
                    swipeHintText.animate().alpha(0f).setDuration(150).start()
                    view.clearAnimation() 
                    isSwipePulseRunning = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = event.rawX - initialX
                    var clampedDelta = deltaX
                    if (clampedDelta > maxDragDistance) clampedDelta = maxDragDistance
                    if (clampedDelta < -maxDragDistance) clampedDelta = -maxDragDistance
                    view.translationX = clampedDelta

                    val progress = abs(clampedDelta) / maxDragDistance
                    swipeColorCircle.alpha = progress * 0.5f 
                    swipeColorCircle.scaleX = 1f + (progress * 6f) 
                    swipeColorCircle.scaleY = 1f + (progress * 6f)

                    if (clampedDelta > 0) {
                        swipeColorCircle.background.setTint(TINT_GREEN) 
                        btnSwipeThumb.imageTintList = ColorStateList.valueOf(TINT_GREEN)
                    } else {
                        swipeColorCircle.background.setTint(TINT_RED) 
                        btnSwipeThumb.imageTintList = ColorStateList.valueOf(TINT_RED)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    val deltaX = event.rawX - initialX
                    val threshold = maxDragDistance * 0.75f 
                    if (deltaX > threshold) {
                        QCallInCallService.answerCurrentCall()
                        switchToOngoingUI(true)
                        dismissKeyguard()
                    } else if (deltaX < -threshold) {
                        QCallInCallService.hangupCurrentCall()
                        finishAndRemoveTask()
                    } else {
                        view.animate().translationX(0f).setDuration(400).setInterpolator(OvershootInterpolator(1.2f)).start()
                        swipeColorCircle.animate().alpha(0f).scaleX(1f).scaleY(1f).setDuration(300).start()
                        swipeHintText.animate().alpha(1f).setDuration(300).start()
                        btnSwipeThumb.imageTintList = ColorStateList.valueOf(TINT_DEFAULT)
                        startThumbPulse()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun startThumbPulse() {
        if (isSwipePulseRunning) return
        isSwipePulseRunning = true
        val scaleX = PropertyValuesHolder.ofFloat("scaleX", 1f, 1.08f)
        val scaleY = PropertyValuesHolder.ofFloat("scaleY", 1f, 1.08f)
        ObjectAnimator.ofPropertyValuesHolder(btnSwipeThumb, scaleX, scaleY).apply {
            duration = 1000
            repeatCount = ObjectAnimator.INFINITE
            repeatMode = ObjectAnimator.REVERSE
            start()
        }
    }

    private fun setupOngoingControls() {
        btnEndCall.setOnClickListener {
            QCallInCallService.hangupCurrentCall()
            finishAndRemoveTask()
        }

        btnMute.setOnClickListener {
            isMuted = !isMuted
            QCallInCallService.setMuted(isMuted)
            updateButtonState(btnMute, txtMute, isMuted, "Mute", "Unmute")
        }

        btnAudioRoute.setOnClickListener { showAudioRouteSheet() }

        btnHold.setOnClickListener {
            isHold = !isHold
            QCallInCallService.holdCall(isHold) 
            updateButtonState(btnHold, txtHold, isHold, "Hold", "Unhold")
            ongoingStatus.text = if (isHold) "On Hold" else "Active Call"
        }

        btnAddCall.setOnClickListener {
            val callCount = QCallInCallService.activeCalls.size
            if (callCount < 2) {
                try {
                    val intent = packageManager.getLaunchIntentForPackage(packageName)
                    if (intent != null) {
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent)
                    }
                } catch (e: Exception) { 
                    Log.e(TAG, "Failed to launch React Native App", e) 
                }
            } else {
                QCallInCallService.swapCalls()
            }
        }

        btnContacts.setOnClickListener {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("qcall://contacts"))
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                startActivity(intent)
            } catch (e: Exception) { Log.e(TAG, "Contacts Failed", e) }
        }

        btnKeypadToggle.setOnClickListener { showKeypadSheet() }
    }

    private fun updateMultiCallUI() {
        val callCount = QCallInCallService.activeCalls.size
        runOnUiThread {
            if (callCount >= 2) {
                btnAddCall.setImageResource(android.R.drawable.ic_menu_directions) 
                try { txtAddCall.text = "Swap" } catch(e:Exception){}
            } else {
                btnAddCall.setImageResource(android.R.drawable.ic_menu_add)
                try { txtAddCall.text = "Add Call" } catch(e:Exception){}
            }
        }
    }

    private fun showKeypadSheet() {
        if (keypadSheet != null && keypadSheet?.isShowing == true) return
        
        keypadSheet = BottomSheetDialog(this) 
        val view = layoutInflater.inflate(R.layout.bottom_sheet_keypad, null)
        
        val display = view.findViewById<TextView>(R.id.sheetDtmfDisplay)
        display.text = dtmfString

        view.findViewById<ImageButton>(R.id.btnBackspace).setOnClickListener {
            if (dtmfString.isNotEmpty()) {
                dtmfString = dtmfString.dropLast(1)
                display.text = dtmfString
            }
        }

        view.findViewById<ImageButton>(R.id.btnKeypadCall)?.setOnClickListener {
            keypadSheet?.dismiss()
        }

        val keys = listOf(R.id.key0, R.id.key1, R.id.key2, R.id.key3, R.id.key4, R.id.key5, R.id.key6, R.id.key7, R.id.key8, R.id.key9, R.id.keyStar, R.id.keyHash)
        val map = mapOf(R.id.key0 to '0', R.id.key1 to '1', R.id.key2 to '2', R.id.key3 to '3', R.id.key4 to '4', R.id.key5 to '5', R.id.key6 to '6', R.id.key7 to '7', R.id.key8 to '8', R.id.key9 to '9', R.id.keyStar to '*', R.id.keyHash to '#')

        // 🟢 CRITICAL FIX: Changed <Button> to <View> to match the new XML structure
        for (id in keys) {
            view.findViewById<View>(id)?.setOnClickListener { 
                val char = map[id] ?: return@setOnClickListener
                QCallInCallService.playDtmf(char) 
                dtmfString += char
                display.text = dtmfString
            }
        }

        keypadSheet?.setContentView(view)
        keypadSheet?.window?.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)?.setBackgroundColor(Color.TRANSPARENT)
        keypadSheet?.show()
    }

    private fun showAudioRouteSheet() {
        val bottomSheetDialog = BottomSheetDialog(this) 
        val view = layoutInflater.inflate(R.layout.bottom_sheet_audio, null)
        
        view.findViewById<LinearLayout>(R.id.routeEarpiece).setOnClickListener {
            QCallInCallService.routeAudio(CallAudioState.ROUTE_EARPIECE)
            bottomSheetDialog.dismiss()
        }
        
        view.findViewById<LinearLayout>(R.id.routeSpeaker).setOnClickListener {
            QCallInCallService.routeAudio(CallAudioState.ROUTE_SPEAKER)
            bottomSheetDialog.dismiss()
        }

        val btRow = view.findViewById<LinearLayout>(R.id.routeBluetooth)
        val btText = view.findViewById<TextView>(R.id.txtRouteBluetooth)
        
        val audioState = QCallInCallService.currentAudioState
        var localBtAvailable = false
        var localBtName = "Bluetooth Device"

        if (audioState != null) {
            localBtAvailable = (audioState.supportedRouteMask and CallAudioState.ROUTE_BLUETOOTH) != 0
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                localBtName = audioState.activeBluetoothDevice?.name 
                    ?: audioState.supportedBluetoothDevices.firstOrNull()?.name 
                    ?: "Bluetooth Device"
            }
        }

        if (localBtAvailable) {
            btRow.visibility = View.VISIBLE
            btText.text = localBtName
            btRow.setOnClickListener {
                QCallInCallService.routeAudio(CallAudioState.ROUTE_BLUETOOTH)
                bottomSheetDialog.dismiss()
            }
        } else {
            btRow.visibility = View.GONE
        }

        bottomSheetDialog.setContentView(view)
        bottomSheetDialog.window?.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)?.setBackgroundColor(Color.TRANSPARENT)
        bottomSheetDialog.show()
    }

    private fun updateAudioUIFromNative(route: Int, btName: String = "Bluetooth") {
        when (route) {
            CallAudioState.ROUTE_SPEAKER -> {
                currentAudioRoute = "Speaker"
                btnAudioRoute.setImageResource(android.R.drawable.stat_sys_speakerphone)
                updateButtonState(btnAudioRoute, txtAudioRoute, true, "Audio", "Speaker")
            }
            CallAudioState.ROUTE_BLUETOOTH -> {
                currentAudioRoute = "Bluetooth"
                btnAudioRoute.setImageResource(android.R.drawable.stat_sys_data_bluetooth)
                updateButtonState(btnAudioRoute, txtAudioRoute, true, "Audio", btName)
            }
            CallAudioState.ROUTE_EARPIECE, CallAudioState.ROUTE_WIRED_HEADSET -> {
                currentAudioRoute = "Earpiece"
                btnAudioRoute.setImageResource(android.R.drawable.stat_sys_speakerphone)
                updateButtonState(btnAudioRoute, txtAudioRoute, false, "Audio", "Audio")
            }
        }
    }

    private fun updateButtonState(btn: ImageView, txt: TextView, isActive: Boolean, inactiveText: String, activeText: String) {
        if (isActive) {
            btn.setBackgroundResource(R.drawable.circle_bg_white)
            btn.imageTintList = ColorStateList.valueOf(Color.parseColor("#0F172A"))
            txt.text = activeText
        } else {
            btn.setBackgroundResource(R.drawable.bg_glass_circle)
            btn.imageTintList = ColorStateList.valueOf(Color.WHITE)
            txt.text = inactiveText
        }
    }

    private fun switchToOngoingUI(startTimerNow: Boolean) {
        runOnUiThread {
            incomingLayout.animate().alpha(0f).setDuration(300).withEndAction {
                incomingLayout.visibility = View.GONE
                ongoingLayout.alpha = 0f
                ongoingLayout.visibility = View.VISIBLE
                ongoingLayout.animate().alpha(1f).setDuration(400).start()
                ongoingStatus.text = "Active Call"
                if (startTimerNow && !isTimerRunning) {
                    isTimerRunning = true
                    handler.post(timerRunnable)
                }
            }.start()
        }
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        }
    }

    private fun dismissKeyguard() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(Context.KEYGUARD_SERVICE).let {
                (it as KeyguardManager).requestDismissKeyguard(this, null)
            }
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
        }
    }

    private fun registerCallReceiver() {
        val filter = IntentFilter().apply { 
            addAction("ACTION_CALL_ENDED")
            addAction("ACTION_CALL_ACTIVE")
            addAction("ACTION_AUDIO_ROUTE_CHANGED") 
            addAction("ACTION_CALL_COUNT_CHANGED") 
        }
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(callStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(callStateReceiver, filter)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        btnSwipeThumb.clearAnimation()
        handler.removeCallbacks(timerRunnable)
        fetchJob?.cancel() 
        try { unregisterReceiver(callStateReceiver) } catch (e: Exception) {}
    }
}