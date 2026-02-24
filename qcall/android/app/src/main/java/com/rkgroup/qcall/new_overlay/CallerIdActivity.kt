package com.rkgroup.qcall.new_overlay

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.ContactsContract
import android.util.Base64
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.animation.Animation
import android.view.animation.AnimationUtils
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import com.rkgroup.qcall.R
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class CallerIdActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "QCall-Native"
        private const val SERVER_URL = "https://unintegrable-adalynn-uninvokable.ngrok-free.dev/api/contacts/identify"
    }

    private lateinit var mainCard: CardView
    private lateinit var headerContainer: LinearLayout
    private lateinit var txtName: TextView
    private lateinit var txtNumber: TextView
    private lateinit var txtTopInfo: TextView
    private lateinit var imgAvatar: ImageView
    private lateinit var txtAvatarFallback: TextView
    private lateinit var adContainer: FrameLayout
    
    private lateinit var premiumBadge: ImageView
    private lateinit var btnViewProfile: TextView
    private lateinit var txtActionSave: TextView
    
    private lateinit var btnActionCall: LinearLayout
    private lateinit var btnActionMessage: LinearLayout
    private lateinit var btnActionSaveBtn: LinearLayout
    private lateinit var btnActionSpam: LinearLayout
    private lateinit var btnActionBlock: LinearLayout

    // 🎨 Standard Colors
    private val COLOR_SAFE_BLUE = Color.parseColor("#1C64F2") 
    private val COLOR_SPAM_RED = Color.parseColor("#DC2626") 
    private val COLOR_VERIFIED_GREEN = Color.parseColor("#10B981") 

    // Local User Settings
    private var hasNoAds = false
    private var isAfterCall = false
    private var callDurationSeconds = 0
    private var hasGoldenId = false

    // 🟢 BUG FIX: Track the network request so we can cancel it if the overlay closes early
    private var fetchJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        setupWindowManager()

        setContentView(R.layout.activity_caller_id)
        window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT)
        window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Color.TRANSPARENT))

        initializeViews()
        
        resetUI() 
        processIntentData(intent)
    }

    // 🟢 BUG FIX: Removed the '?' to match strict Kotlin null-safety rules
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        Log.d(TAG, "🔔 onNewIntent triggered: Fresh call arrived while overlay was open.")
        
        resetUI()
        processIntentData(intent)
    }

    private fun processIntentData(currentIntent: Intent) {
        val sharedPref: SharedPreferences = getSharedPreferences("QcallPrefs", Context.MODE_PRIVATE)
        val allowedFeatures = sharedPref.getStringSet("allowedFeatures", emptySet()) ?: emptySet()
        
        hasNoAds = allowedFeatures.contains("no_ads")
        hasGoldenId = allowedFeatures.contains("golden_caller_id")

        if (hasNoAds) {
            adContainer.visibility = View.GONE
        }

        val number = currentIntent.getStringExtra("number") ?: "Unknown"
        val passedName = currentIntent.getStringExtra("name")
        isAfterCall = currentIntent.getBooleanExtra("isAfterCall", false)
        callDurationSeconds = currentIntent.getIntExtra("duration", 0)
        
        txtNumber.text = number

        setupClickListeners(number)
        showCard()
        
        identifyCaller(number, passedName, hasGoldenId)
    }

    private fun resetUI() {
        txtName.text = "Loading Caller Info..."
        txtNumber.text = "..."
        txtTopInfo.text = "QCALL • Analyzing..."
        imgAvatar.visibility = View.GONE
        txtAvatarFallback.visibility = View.GONE
        premiumBadge.visibility = View.GONE
        
        headerContainer.background = android.graphics.drawable.ColorDrawable(COLOR_SAFE_BLUE)
        txtName.setTextColor(Color.WHITE)
        txtTopInfo.setTextColor(Color.WHITE)
        txtNumber.setTextColor(Color.parseColor("#E6FFFFFF"))
    }

    private fun setupWindowManager() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val params = window.attributes
            params.type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
            window.attributes = params
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        }
    }

    private fun initializeViews() {
        mainCard = findViewById(R.id.mainCard)
        headerContainer = findViewById(R.id.headerContainer)
        txtName = findViewById(R.id.txtName)
        txtNumber = findViewById(R.id.txtNumber)
        txtTopInfo = findViewById(R.id.txtTopInfo)
        imgAvatar = findViewById(R.id.imgAvatar)
        txtAvatarFallback = findViewById(R.id.txtAvatarFallback)
        adContainer = findViewById(R.id.adContainer)
        
        premiumBadge = findViewById(R.id.premiumBadge)
        btnViewProfile = findViewById(R.id.btnViewProfile)
        txtActionSave = findViewById(R.id.txtActionSave)

        btnActionCall = findViewById(R.id.btnActionCall)
        btnActionMessage = findViewById(R.id.btnActionMessage)
        btnActionSaveBtn = findViewById(R.id.btnActionSave)
        btnActionSpam = findViewById(R.id.btnActionSpam) 
        btnActionBlock = findViewById(R.id.btnActionBlock)

        mainCard.visibility = View.INVISIBLE
    }

    private fun setupClickListeners(number: String) {
        findViewById<ImageButton>(R.id.btnClose).setOnClickListener { closeOverlay() }
        btnActionCall.setOnClickListener {
            closeOverlay()
            try {
                val callIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
                callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(callIntent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to open dialer", e)
            }
        }
        btnViewProfile.setOnClickListener { openDeepLink("qcall://caller-id/view-profile?number=$number") }
        btnActionMessage.setOnClickListener { openDeepLink("sms:$number") }
        btnActionSaveBtn.setOnClickListener { openDeepLink("qcall://caller-id/save-contact?number=$number") }
        btnActionSpam.setOnClickListener { openDeepLink("qcall://caller-id/report-spam?number=$number") }
        btnActionBlock.setOnClickListener { openDeepLink("qcall://caller-id/block-number?number=$number") }
    }

    private fun identifyCaller(number: String, passedName: String?, userHasGoldFeature: Boolean) {
        // Cancel any previous job to avoid overlapping data if they call twice fast
        fetchJob?.cancel() 
        
        fetchJob = CoroutineScope(Dispatchers.IO).launch {
            val rawNum = number.replace(Regex("[^0-9]"), "")
            val last10 = if (rawNum.length >= 10) rawNum.takeLast(10) else rawNum
            
            val localJob = async { getLocalContactInfo(number) }
            val serverJob = async { 
                var res = fetchFromServer("91$last10")
                if (res == null || !res.found) res = fetchFromServer(last10)
                res
            }

            val localContact = localJob.await()
            var currentName = passedName ?: "Unknown Caller"
            var isSavedLocally = false

            if (localContact != null) {
                isSavedLocally = true
                currentName = localContact.name
                
                if (isActive) { // Check if coroutine is still alive before updating UI
                    withContext(Dispatchers.Main) {
                        updateUI(currentName, localContact.photoUri, null, isSpam = false, isPremiumCaller = false, isVerifiedUser = false, isSaved = true, forceGold = userHasGoldFeature)
                    }
                }
            }

            val result = serverJob.await()

            if (isActive) { // Safety check
                withContext(Dispatchers.Main) {
                    if (result != null && result.found) {
                        val finalName = if (isSavedLocally) currentName else (result.name ?: currentName)
                        updateUI(
                            name = finalName, 
                            photoUri = if (isSavedLocally) localContact?.photoUri else null, 
                            photoBitmap = result.bitmap, 
                            isSpam = result.isSpam, 
                            isPremiumCaller = result.isPremiumUser, 
                            isVerifiedUser = result.isVerifiedUser,
                            isSaved = isSavedLocally,
                            forceGold = userHasGoldFeature
                        )
                    } else if (!isSavedLocally) {
                        updateUI(currentName, null, null, isSpam = false, isPremiumCaller = false, isVerifiedUser = false, isSaved = false, forceGold = userHasGoldFeature)
                    }
                }
            }
        }
    }

    private fun updateUI(name: String?, photoUri: String?, photoBitmap: Bitmap?, isSpam: Boolean, isPremiumCaller: Boolean, isVerifiedUser: Boolean, isSaved: Boolean, forceGold: Boolean) {
        val displayName = name ?: "Unknown Caller"
        txtName.text = displayName
        premiumBadge.visibility = View.GONE
        
        val headerPrefix = if (isAfterCall) "Call ended • ${formatDuration(callDurationSeconds)}" else "QCALL • Incoming Call"

        when {
            isSpam -> applySolidTheme(COLOR_SPAM_RED, "Likely Spam • $headerPrefix")
            isPremiumCaller || forceGold -> {
                applyShinyGoldTheme("👑 Premium Gold • $headerPrefix")
                premiumBadge.visibility = View.VISIBLE
            }
            isVerifiedUser -> applySolidTheme(COLOR_VERIFIED_GREEN, "Verified QCall User • $headerPrefix")
            else -> applySolidTheme(COLOR_SAFE_BLUE, if(isSaved) "Saved Contact • $headerPrefix" else headerPrefix)
        }

        updateAvatar(displayName, photoUri, photoBitmap)
    }

    private fun applySolidTheme(color: Int, topText: String) {
        headerContainer.background = android.graphics.drawable.ColorDrawable(color)
        txtTopInfo.text = topText
        txtName.setTextColor(Color.WHITE)
        txtTopInfo.setTextColor(Color.WHITE)
        txtAvatarFallback.setTextColor(color) 
        txtNumber.setTextColor(Color.parseColor("#E6FFFFFF"))
    }

    private fun applyShinyGoldTheme(topText: String) {
        val goldColors = intArrayOf(
            Color.parseColor("#E1C470"),
            Color.parseColor("#FBE493"),
            Color.parseColor("#C59937") 
        )
        val gradient = GradientDrawable(GradientDrawable.Orientation.TL_BR, goldColors)
        headerContainer.background = gradient

        txtTopInfo.text = topText
        
        val darkBrown = Color.parseColor("#2C271E")
        val fadedBrown = Color.parseColor("#5A5243")
        
        txtName.setTextColor(darkBrown)
        txtTopInfo.setTextColor(fadedBrown)
        txtNumber.setTextColor(fadedBrown)
        txtAvatarFallback.setTextColor(Color.parseColor("#C59937"))
    }

    private fun updateAvatar(displayName: String, photoUri: String?, photoBitmap: Bitmap?) {
        imgAvatar.visibility = View.GONE
        txtAvatarFallback.visibility = View.VISIBLE
        
        try {
            if (photoBitmap != null) {
                imgAvatar.visibility = View.VISIBLE
                txtAvatarFallback.visibility = View.GONE
                imgAvatar.setImageBitmap(photoBitmap)
            } else if (photoUri != null) {
                imgAvatar.visibility = View.VISIBLE
                txtAvatarFallback.visibility = View.GONE
                imgAvatar.setImageURI(Uri.parse(photoUri))
            } else {
                val letter = if (displayName.isNotEmpty()) displayName.substring(0, 1).uppercase(Locale.getDefault()) else "?"
                txtAvatarFallback.text = letter
            }
        } catch (e: Exception) {
            txtAvatarFallback.text = "?"
        }
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
                
                if (json.optBoolean("found", false)) {
                    val name = json.optString("name", "Unknown")
                    val isSpam = json.optBoolean("isSpam", false)
                    val isPremiumUser = json.optBoolean("isPremium", false) 
                    val isVerifiedUser = json.optBoolean("isVerified", false)
                    
                    val photoBase64 = json.optString("photo", "")
                    var apiBitmap: Bitmap? = null
                    if (photoBase64.isNotEmpty()) {
                        try {
                            val decodedString = Base64.decode(photoBase64, Base64.DEFAULT)
                            apiBitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.size)
                        } catch (e: Exception) {}
                    }
                    return ServerResult(true, name, isSpam, isPremiumUser, isVerifiedUser, apiBitmap, null)
                }
            }
        } catch (e: Exception) { Log.e(TAG, "Fetch Error", e) }
        return ServerResult(false, null, false, false, false, null, null)
    }

    data class ServerResult(val found: Boolean, val name: String?, val isSpam: Boolean, val isPremiumUser: Boolean, val isVerifiedUser: Boolean, val bitmap: Bitmap?, val errorMessage: String?)

    private fun getLocalContactInfo(phoneNumber: String): LocalContact? {
        if (checkSelfPermission(android.Manifest.permission.READ_CONTACTS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return null
        try {
            val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber))
            val cursor = contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME, ContactsContract.PhoneLookup.PHOTO_URI), null, null, null)
            cursor?.use {
                if (it.moveToFirst()) return LocalContact(it.getString(0), it.getString(1))
            }
        } catch (e: Exception) { e.printStackTrace() }
        return null
    }

    data class LocalContact(val name: String, val photoUri: String?)

    private fun formatDuration(seconds: Int): String {
        if (seconds == 0) return "0s"
        val m = seconds / 60
        val s = seconds % 60
        return if (m > 0) "${m}m ${s}s" else "${s}s"
    }

    // 🟢 BUG FIX: Prevent crashes if a user's phone cannot handle the Deep Link
    private fun openDeepLink(link: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
            closeOverlay()
        } catch (e: Exception) { 
            Log.e(TAG, "Error opening link: No app found to handle $link", e) 
        }
    }

    private fun showCard() {
        mainCard.visibility = View.VISIBLE
        val anim = AnimationUtils.loadAnimation(this, R.anim.slide_in_bottom)
        mainCard.startAnimation(anim)
    }

    private fun closeOverlay() {
        val anim = AnimationUtils.loadAnimation(this, R.anim.slide_out_bottom)
        anim.setAnimationListener(object : Animation.AnimationListener {
            override fun onAnimationStart(animation: Animation?) {}
            override fun onAnimationRepeat(animation: Animation?) {}
            override fun onAnimationEnd(animation: Animation?) {
                mainCard.visibility = View.GONE
                finishAndRemoveTask()
                overridePendingTransition(0, 0)
            }
        })
        mainCard.startAnimation(anim)
    }

    // 🟢 BUG FIX: Ensure background tasks are killed when the screen is destroyed
    override fun onDestroy() {
        super.onDestroy()
        fetchJob?.cancel()
    }
}