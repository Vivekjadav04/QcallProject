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
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.view.animation.AnimationUtils
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RelativeLayout
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

    // Colors
    private val COLOR_BLUE = Color.parseColor("#0087FF") // Normal
    private val COLOR_RED = Color.parseColor("#FF3B30")   // Spam

    override fun onCreate(savedInstanceState: Bundle?) {
        // 1. FORCE WINDOW TYPE TO OVERLAY (Top Priority)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val params = window.attributes
            params.type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
            window.attributes = params
        }

        // 2. LOCK SCREEN & WAKE UP LOGIC
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
        
        // 3. BIND VIEWS
        mainCard = findViewById(R.id.mainCard)
        headerContainer = findViewById(R.id.headerContainer)
        txtName = findViewById(R.id.txtName)
        txtNumber = findViewById(R.id.txtNumber)
        txtTopInfo = findViewById(R.id.txtTopInfo)
        
        imgAvatar = findViewById(R.id.imgAvatar)
        txtAvatarFallback = findViewById(R.id.txtAvatarFallback) // Text Fallback ("A")
        
        // Buttons
        val btnClose = findViewById<ImageButton>(R.id.btnClose)
        btnActionCall = findViewById(R.id.btnActionCall)
        btnActionSpam = findViewById(R.id.btnActionSpam)
        btnActionSave = findViewById(R.id.btnActionSave)
        btnActionBlock = findViewById(R.id.btnActionBlock)
        btnViewProfile = findViewById(R.id.btnViewProfile)

        // Hide initially for animation
        mainCard.visibility = View.INVISIBLE

        // 4. GET DATA
        val number = intent.getStringExtra("number") ?: "Unknown"
        val passedName = intent.getStringExtra("name")
        txtNumber.text = number

        // 5. CLICK LISTENERS
        btnClose.setOnClickListener { closeOverlay() }

        btnActionCall.setOnClickListener {
            closeOverlay()
            val callIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))
            startActivity(callIntent)
        }

        btnActionSpam.setOnClickListener {
            closeOverlay()
            openDeepLink("caller-id/spam-report", number)
        }

        btnActionSave.setOnClickListener {
            closeOverlay()
            openDeepLink("caller-id/save-contact", number)
        }

        btnActionBlock.setOnClickListener {
            closeOverlay()
            openDeepLink("caller-id/block-number", number)
        }

        btnViewProfile.setOnClickListener {
            closeOverlay()
            openDeepLink("caller-id/view-profile", number)
        }

        // 6. START IDENTIFICATION LOGIC (With Delay)
        Handler(Looper.getMainLooper()).postDelayed({
            identifyCaller(number, passedName)
            showCard()
        }, 2500)
    }

    private fun showCard() {
        mainCard.visibility = View.VISIBLE
        val anim = AnimationUtils.loadAnimation(this, R.anim.popup_enter)
        mainCard.startAnimation(anim)
    }

    private fun closeOverlay() {
        val anim = AnimationUtils.loadAnimation(this, R.anim.popup_exit)
        mainCard.startAnimation(anim)
        Handler(Looper.getMainLooper()).postDelayed({
            finishAndRemoveTask()
            overridePendingTransition(0, 0)
        }, 200)
    }

    private fun openDeepLink(path: String, number: String) {
        try {
            val uri = Uri.parse("qcall://$path?number=$number")
            val intent = Intent(Intent.ACTION_VIEW, uri)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // 🟢 UPDATED LOGIC: Local -> Network (Backend) -> Fallback
    private fun identifyCaller(number: String, passedName: String?) {
        CoroutineScope(Dispatchers.IO).launch {
            
            // Step A: Check Local Contacts
            val localContact = getLocalContactInfo(number)

            if (localContact != null) {
                withContext(Dispatchers.Main) {
                    updateUI(localContact.name, localContact.photoUri, null, isSpam = false, isSaved = true)
                }
                return@launch
            }

            // Step B: Check Backend API (Network Request)
            try {
                // 🔴 IMPORTANT: Ensure your PC IP is correct and Port is 5000
                val urlString = "http://192.168.1.5:5000/api/contacts/identify?number=$number"
                val url = URL(urlString)
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 3000 // 3 seconds timeout
                connection.readTimeout = 3000

                if (connection.responseCode == 200) {
                    val stream = connection.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(stream)
                    
                    val found = json.optBoolean("found", false)
                    
                    if (found) {
                        val name = json.optString("name", "Unknown")
                        val isSpam = json.optBoolean("isSpam", false)
                        val photoBase64 = json.optString("photo", "")
                        
                        // Decode Base64 Photo if present
                        var apiBitmap: Bitmap? = null
                        if (photoBase64.isNotEmpty()) {
                            try {
                                val decodedString = Base64.decode(photoBase64, Base64.DEFAULT)
                                apiBitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.size)
                            } catch (e: Exception) { e.printStackTrace() }
                        }

                        withContext(Dispatchers.Main) {
                            updateUI(name, null, apiBitmap, isSpam = isSpam, isSaved = false)
                        }
                        return@launch
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            // Step C: Fallback / Unknown / Spam Check
            withContext(Dispatchers.Main) {
                if (!passedName.isNullOrEmpty() && passedName != "Unknown") {
                    updateUI(passedName, null, null, isSpam = false, isSaved = false)
                } else {
                    // Simple Offline Spam Check
                    val isSpam = number.startsWith("140") || number.contains("spam")
                    val finalName = if(isSpam) "Likely Spam" else "Unknown Caller"
                    updateUI(finalName, null, null, isSpam = isSpam, isSaved = false)
                }
            }
        }
    }

    // 🟢 UPDATED UI: Now accepts Bitmap for Base64 photos
    private fun updateUI(name: String, photoUri: String?, photoBitmap: Bitmap?, isSpam: Boolean, isSaved: Boolean) {
        txtName.text = name
        
        // 1. Header & Text Color
        if (isSpam) {
            headerContainer.setBackgroundColor(COLOR_RED)
            txtTopInfo.text = "Likely Spam • Incoming"
            txtAvatarFallback.setTextColor(COLOR_RED)
        } else {
            headerContainer.setBackgroundColor(COLOR_BLUE)
            txtTopInfo.text = if (isSaved) "Saved Contact • Incoming" else "Incoming Call • SIM 1"
            txtAvatarFallback.setTextColor(COLOR_BLUE)
        }

        // 2. Avatar Logic (Bitmap > Uri > Fallback)
        imgAvatar.visibility = View.GONE
        txtAvatarFallback.visibility = View.VISIBLE
        
        try {
            if (photoBitmap != null) {
                imgAvatar.visibility = View.VISIBLE
                txtAvatarFallback.visibility = View.GONE
                imgAvatar.setImageBitmap(photoBitmap)
                imgAvatar.setColorFilter(null)
            } else if (photoUri != null) {
                imgAvatar.visibility = View.VISIBLE
                txtAvatarFallback.visibility = View.GONE
                imgAvatar.setImageURI(Uri.parse(photoUri))
                imgAvatar.setColorFilter(null)
            } else {
                showFallbackText(name)
            }
        } catch (e: Exception) {
            showFallbackText(name)
        }
    }

    private fun showFallbackText(name: String) {
        imgAvatar.visibility = View.GONE
        txtAvatarFallback.visibility = View.VISIBLE
        val letter = if (name.isNotEmpty()) name.substring(0, 1).uppercase(Locale.getDefault()) else "?"
        txtAvatarFallback.text = letter
    }

    // Helper Data Class
    data class LocalContact(val name: String, val photoUri: String?)

    // Fetch Local Contact
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