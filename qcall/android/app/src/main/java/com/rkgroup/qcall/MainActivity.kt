package com.rkgroup.qcall

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.Call
import android.telecom.TelecomManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

import com.rkgroup.qcall.native_telephony.QCallInCallService 
import com.rkgroup.qcall.CallActivity

class MainActivity : ReactActivity() {

    private val SCREENING_REQUEST_ID = 123 // 🟢 Unique ID for the Role Request

    override fun onCreate(savedInstanceState: Bundle?) {
        // 1. Check for active calls immediately
        checkAndLaunchCallScreen()

        // 2. Request Call Screening Role (Required for Android 10+)
        requestCallScreeningRole()
        
        super.onCreate(null)
    }

    override fun onStart() {
        super.onStart()
        checkAndLaunchCallScreen()
    }

    override fun onResume() {
        super.onResume()
        checkAndLaunchCallScreen()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    // 🟢 NEW: Logic to request the Call Screening Role from the User
    private fun requestCallScreeningRole() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(Context.ROLE_SERVICE) as RoleManager
            
            // Check if QCall is already the screening app
            val isRoleHeld = roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
            
            if (!isRoleHeld) {
                // Trigger the system popup
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                startActivityForResult(intent, SCREENING_REQUEST_ID)
            }
        }
    }

    override fun getMainComponentName(): String = "main"

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return ReactActivityDelegateWrapper(
            this,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
            object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {}
        )
    }

    override fun invokeDefaultOnBackPressed() {
        if (android.os.Build.VERSION.SDK_INT <= android.os.Build.VERSION_CODES.R) {
            if (!moveTaskToBack(false)) { super.invokeDefaultOnBackPressed() }
            return
        }
        super.invokeDefaultOnBackPressed()
    }

    private fun checkAndLaunchCallScreen() {
        try {
            val currentCall = QCallInCallService.currentCall
            
            if (currentCall != null) {
                val status = if (currentCall.state == Call.STATE_RINGING) "Incoming" else "Active"
                val name = QCallInCallService.lastCallerName
                val number = QCallInCallService.lastCallerNumber

                val intent = Intent(this, CallActivity::class.java).apply {
                    putExtra("contact_name", name)
                    putExtra("contact_number", number)
                    putExtra("call_status", status)
                    putExtra("is_test_mode", false)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or 
                            Intent.FLAG_ACTIVITY_SINGLE_TOP or
                            Intent.FLAG_ACTIVITY_NO_ANIMATION 
                }
                startActivity(intent)
            }
        } catch (e: Exception) {
            // Safety ignore
        }
    }
}