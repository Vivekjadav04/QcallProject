package com.rkgroup.qcall

import expo.modules.splashscreen.SplashScreenManager
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    SplashScreenManager.registerOnActivity(this)
    super.onCreate(null)
    // 🟢 REMOVED Automatic Role Request (Handled in React Native now)
  }

  // 🟢 ADDED: Handle taps on notification when app is in background
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
}