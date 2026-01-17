package com.rkgroup.qcall

import android.content.Intent
import android.os.Bundle
import android.telecom.Call
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper
// 🔴 REMOVED: import expo.modules.splashscreen.SplashScreenManager

import com.rkgroup.qcall.native_telephony.QCallInCallService 
import com.rkgroup.qcall.CallActivity

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // 🟢 OPTIMIZATION: Check for calls INSTANTLY
    checkAndLaunchCallScreen()

    // 🔴 REMOVED: SplashScreenManager.registerOnActivity(this)
    // We removed this so the app doesn't wait. Native Splash hands off directly.
    
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

  // 🟢 6. THE MAGIC FUNCTION (Updated for Single Activity)
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