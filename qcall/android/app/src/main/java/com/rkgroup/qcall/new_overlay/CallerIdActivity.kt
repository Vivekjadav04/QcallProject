package com.rkgroup.qcall.new_overlay

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
import android.telecom.TelecomManager
import android.util.Base64
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.animation.Animation
import android.view.animation.AnimationUtils
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.core.content.ContextCompat
import com.rkgroup.qcall.R
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class CallerIdActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "QCall-Native"
        // ⚠️ CRITICAL: Ensure this matches your current Ngrok URL
        private const val SERVER_URL = "https://unintegrable-adalynn-uninvokable.ngrok-free.dev/api/contacts/identify"
    }

    // UI Elements
    private lateinit var mainCard: CardView
    private lateinit var headerContainer: RelativeLayout
    private lateinit var txtName: TextView
    private lateinit var txtNumber: TextView
    private lateinit var txtTopInfo: TextView
    
    // Avatar Elements
    private lateinit var imgAvatar: ImageView
    private lateinit var txtAvatarFallback: TextView

    // Action Buttons
    private lateinit var btnActionCall: LinearLayout
    private lateinit var btnActionSpam: LinearLayout
    private lateinit var btnActionSave: LinearLayout
    private lateinit var btnActionBlock: LinearLayout
    private lateinit var btnViewProfile: TextView

    private val COLOR_BLUE = Color.parseColor("#0087FF")
    private val COLOR_RED = Color.parseColor("#FF3B30")

    override fun onCreate(savedInstanceState: Bundle?) {
        Log.d(TAG, "🚀 CallerIdActivity Created")

        // 1. Window Configuration for Overlay (Show over Lock Screen)
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
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
            )
        }

        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_caller_id)
        
        // 2. Bind Views
        mainCard = findViewById(R.id.mainCard)
        headerContainer = findViewById(R.id.headerContainer)
        txtName = findViewById(R.id.txtName)
        txtNumber = findViewById(R.id.txtNumber)
        txtTopInfo = findViewById(R.id.txtTopInfo)
        
        imgAvatar = findViewById(R.id.imgAvatar)
        txtAvatarFallback = findViewById(R.id.txtAvatarFallback)
        
        val btnClose = findViewById<ImageButton>(R.id.btnClose)
        btnActionCall = findViewById(R.id.btnActionCall)
        btnActionSpam = findViewById(R.id.btnActionSpam)
        btnActionSave = findViewById(R.id.btnActionSave)
        btnActionBlock = findViewById(R.id.btnActionBlock)
        btnViewProfile = findViewById(R.id.btnViewProfile)

        mainCard.visibility = View.INVISIBLE

        val number = intent.getStringExtra("number") ?: "Unknown"
        val passedName = intent.getStringExtra("name")
        txtNumber.text = number

        // ---------------- BUTTON ACTIONS ----------------

        // ❌ Close Button
        btnClose.setOnClickListener { closeOverlay() }

        // 📞 BUTTON 1: CALL / REDIRECT TO ONGOING CALL
        btnActionCall.setOnClickListener {
            closeOverlay()
            try {
                val telecomManager = getSystemService(Context.TELECOM_SERVICE) as TelecomManager
                
                // Check if we are already in a call (requires permission READ_PHONE_STATE, usually granted to Default Dialer)
                if (checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) == android.content.pm.PackageManager.PERMISSION_GRANTED && telecomManager.isInCall) {
                    Log.d(TAG, "Ongoing call detected. Redirecting to In-Call Screen.")
                    telecomManager.showInCallScreen(false)
                } else {
                    Log.d(TAG, "No active call found. Initiating new dial.")
                    val callIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
                    callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(callIntent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in Call Action", e)
                val callIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
                callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(callIntent)
            }
        }

        // 🟢 UPDATED DEEP LINKS FOR EXPO ROUTER PATHS

        // 🚫 BUTTON 2: REPORT SPAM -> Opens 'app/caller-id/spam-report.tsx'
        btnActionSpam.setOnClickListener {
            openDeepLink("qcall://caller-id/spam-report?number=$number", "Report Spam")
        }

        // 💾 BUTTON 3: SAVE CONTACT -> Opens 'app/caller-id/save-contact.tsx'
        btnActionSave.setOnClickListener {
            openDeepLink("qcall://caller-id/save-contact?number=$number", "Save Contact")
        }

        // 🛑 BUTTON 4: BLOCK NUMBER -> Opens 'app/caller-id/block-number.tsx'
        btnActionBlock.setOnClickListener {
            openDeepLink("qcall://caller-id/block-number?number=$number", "Block Number")
        }

        // 👤 VIEW PROFILE -> Opens 'app/caller-id/view-profile.tsx'
        btnViewProfile.setOnClickListener {
             openDeepLink("qcall://caller-id/view-profile?number=$number", "View Profile")
        }

        // ---------------- IDENTIFICATION LOGIC ----------------
        Log.d(TAG, "⏳ Waiting 4.5 seconds before showing overlay...")
        Handler(Looper.getMainLooper()).postDelayed({
            identifyCaller(number, passedName)
            showCard()
        }, 4500)
    }

    // Helper to open Deep Links cleanly
    private fun openDeepLink(link: String, actionName: String) {
        try {
            Log.d(TAG, "Opening App for $actionName: $link")
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
            closeOverlay()
        } catch (e: Exception) {
            Log.e(TAG, "Error opening deep link", e)
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

    // ---------------- SERVER & DATA LOGIC ----------------
    private fun identifyCaller(number: String, passedName: String?) {
        CoroutineScope(Dispatchers.IO).launch {
            val rawNum = number.replace(Regex("[^0-9]"), "")
            val last10 = if (rawNum.length >= 10) rawNum.takeLast(10) else rawNum
            
            // A. Local Check
            val localContact = getLocalContactInfo(number)
            if (localContact != null) {
                withContext(Dispatchers.Main) {
                    updateUI(localContact.name, localContact.photoUri, null, isSpam = false, isSaved = true)
                }
                return@launch
            }

            // B. Server Check (Try '91' then '10 digits')
            val queryWithCode = "91$last10"
            var result = fetchFromServer(queryWithCode)
            if (result == null || !result.found) {
                 val retryResult = fetchFromServer(last10)
                 if (retryResult != null && retryResult.found) result = retryResult
            }

            // C. UI Update
            withContext(Dispatchers.Main) {
                if (result != null && result.found) {
                    updateUI(result.name, null, result.bitmap, isSpam = result.isSpam, isSaved = false)
                } else if (result != null && result.errorMessage != null) {
                    updateUI("Error: ${result.errorMessage}", null, null, isSpam = true, isSaved = false)
                } else {
                    val finalName = if (!passedName.isNullOrEmpty() && passedName != "Unknown") passedName else "Unknown Caller"
                    updateUI(finalName, null, null, isSpam = false, isSaved = false)
                }
            }
        }
    }

    private fun fetchFromServer(queryNumber: String): ServerResult? {
        try {
            val urlString = "$SERVER_URL?number=$queryNumber"
            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 3000
            connection.readTimeout = 3000
            
            val code = connection.responseCode
            if (code == 200) {
                val stream = connection.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(stream)
                if (json.optBoolean("found", false)) {
                    val name = json.optString("name", "Unknown")
                    val isSpam = json.optBoolean("isSpam", false)
                    val photoBase64 = json.optString("photo", "")
                    var apiBitmap: Bitmap? = null
                    if (photoBase64.isNotEmpty()) {
                        try {
                            val decodedString = Base64.decode(photoBase64, Base64.DEFAULT)
                            apiBitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.size)
                        } catch (e: Exception) {}
                    }
                    return ServerResult(true, name, isSpam, apiBitmap, null)
                } else {
                    return ServerResult(false, null, false, null, null)
                }
            } else {
                return ServerResult(false, null, false, null, "HTTP $code")
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return ServerResult(false, null, false, null, e.message ?: "Connect Fail")
        }
    }

    data class ServerResult(
        val found: Boolean,
        val name: String?,
        val isSpam: Boolean,
        val bitmap: Bitmap?,
        val errorMessage: String?
    )

    private fun updateUI(name: String?, photoUri: String?, photoBitmap: Bitmap?, isSpam: Boolean, isSaved: Boolean) {
        val displayName = name ?: "Unknown Caller"
        txtName.text = displayName
        
        if (isSpam || displayName.startsWith("Error:")) {
            headerContainer.setBackgroundColor(COLOR_RED)
            txtTopInfo.text = if (displayName.startsWith("Error:")) "Connection Error" else "Likely Spam"
            txtAvatarFallback.setTextColor(COLOR_RED)
        } else {
            headerContainer.setBackgroundColor(COLOR_BLUE)
            txtTopInfo.text = if (isSaved) "Saved Contact" else "Global Directory"
            txtAvatarFallback.setTextColor(COLOR_BLUE)
        }

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
                showFallbackText(displayName)
            }
        } catch (e: Exception) {
            showFallbackText(displayName)
        }
    }

    private fun showFallbackText(name: String) {
        imgAvatar.visibility = View.GONE
        txtAvatarFallback.visibility = View.VISIBLE
        val letter = if (name.isNotEmpty()) name.substring(0, 1).uppercase(Locale.getDefault()) else "?"
        txtAvatarFallback.text = letter
    }

    data class LocalContact(val name: String, val photoUri: String?)

    private fun getLocalContactInfo(phoneNumber: String): LocalContact? {
        if (checkSelfPermission(android.Manifest.permission.READ_CONTACTS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            return null
        }
        var contact: LocalContact? = null
        try {
            val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber))
            val projection = arrayOf(
                ContactsContract.PhoneLookup.DISPLAY_NAME,
                ContactsContract.PhoneLookup.PHOTO_URI
            )
            val cursor = contentResolver.query(uri, projection, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val name = it.getString(0)
                    val photo = it.getString(1)
                    contact = LocalContact(name, photo)
                }
            }
        } catch (e: Exception) { e.printStackTrace() }
        return contact
    }
}