package com.rkgroup.qcall

import android.content.Intent
import android.os.Bundle
import android.telecom.Call // 🟢 Import Call
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper
import expo.modules.splashscreen.SplashScreenManager

// 🟢 Import our Service and Activities
import com.rkgroup.qcall.native_telephony.QCallInCallService 
import com.rkgroup.qcall.IncomingCallActivity
import com.rkgroup.qcall.OngoingCallActivity

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // 🟢 OPTIMIZATION 1: Check for calls INSTANTLY (before Splash/React Native)
    // This executes in < 10ms, effectively blocking the blue screen.
    checkAndLaunchCallScreen()

    // 1. Setup Expo Splash Screen
    SplashScreenManager.registerOnActivity(this)
    super.onCreate(null)
  }

  // 🟢 2. Also check on Start (Double safety)
  override fun onStart() {
    super.onStart()
    checkAndLaunchCallScreen()
  }

  // 🟢 3. Also check on Resume (Coming from background)
  override fun onResume() {
    super.onResume()
    checkAndLaunchCallScreen()
  }

  // 🟢 4. Handle Notification Taps
  override fun onNewIntent(intent: Intent) {
      super.onNewIntent(intent)
      setIntent(intent)
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

  // 🟢 6. THE MAGIC FUNCTION (Optimized)
  private fun checkAndLaunchCallScreen() {
    try {
        // Direct access to Service (Instant)
        val currentCall = QCallInCallService.currentCall
        
        if (currentCall != null) {
            // Determine screen
            val targetActivity = if (currentCall.state == Call.STATE_RINGING) {
                IncomingCallActivity::class.java
            } else {
                OngoingCallActivity::class.java
            }

            // Get Details
            val name = QCallInCallService.lastCallerName
            val number = QCallInCallService.lastCallerNumber

            // 🚀 LAUNCH IMMEDIATELY
            val intent = Intent(this, targetActivity).apply {
                putExtra("contact_name", name)
                putExtra("contact_number", number)
                putExtra("is_test_mode", false)
                
                // 🟢 OPTIMIZATION 2: NO_ANIMATION flag makes it appear instantly
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