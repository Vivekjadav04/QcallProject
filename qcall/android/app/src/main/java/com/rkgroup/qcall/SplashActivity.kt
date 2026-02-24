package com.rkgroup.qcall

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.ImageView
import android.widget.TextView // 🟢 Added this import
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        // 🟢 UPDATED: It is now a TextView, and the ID is logo_text
        val logo = findViewById<TextView>(R.id.logo_text)
        val ripple1 = findViewById<ImageView>(R.id.ripple_1)
        val ripple2 = findViewById<ImageView>(R.id.ripple_2)
        val textContainer = findViewById<View>(R.id.text_container)

        // 1. ANIMATION: Bouncy Logo Pop-in
        logo.scaleX = 0f
        logo.scaleY = 0f
        logo.alpha = 0f

        logo.animate()
            .scaleX(1f).scaleY(1f).alpha(1f)
            .setDuration(800)
            .setInterpolator(OvershootInterpolator(1.5f)) // The "Bounce" factor
            .start()

        // 2. ANIMATION: Ripples (Signal Effect)
        // Starts after logo pops in
        Handler(Looper.getMainLooper()).postDelayed({
            startRipple(ripple1, 0)
            startRipple(ripple2, 800) // Second ripple starts later
        }, 500)

        // 3. ANIMATION: Glassmorphism Card Slide Up
        textContainer.translationY = 100f
        textContainer.animate()
            .translationY(0f).alpha(1f)
            .setDuration(800)
            .setStartDelay(600) // Wait for logo to finish bouncing
            .setInterpolator(AccelerateDecelerateInterpolator())
            .start()

        // 4. NAVIGATION: Go to Main App after 4 seconds
        Handler(Looper.getMainLooper()).postDelayed({
            val intent = Intent(this, MainActivity::class.java)
            startActivity(intent)
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }, 4000)
    }

    // Helper to create infinite ripple effect
    private fun startRipple(view: View, delay: Long) {
        val scaleX = ObjectAnimator.ofFloat(view, "scaleX", 1f, 3.5f)
        val scaleY = ObjectAnimator.ofFloat(view, "scaleY", 1f, 3.5f)
        val alpha = ObjectAnimator.ofFloat(view, "alpha", 0.4f, 0f)

        val set = AnimatorSet()
        set.playTogether(scaleX, scaleY, alpha)
        set.duration = 2000 // Speed of ripple
        set.startDelay = delay
        set.interpolator = AccelerateDecelerateInterpolator()
        
        // Make it repeat infinitely
        for (anim in set.childAnimations) {
            if (anim is ValueAnimator) {
                anim.repeatCount = ValueAnimator.INFINITE
                anim.repeatMode = ValueAnimator.RESTART
            }
        }
        
        set.start()
    }
}