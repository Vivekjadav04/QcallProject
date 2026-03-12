package com.rkgroup.qcall

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        val logo = findViewById<ImageView>(R.id.logo_img)
        val qcallText = findViewById<TextView>(R.id.qcall_text)

        // 1. INITIAL STATE: Logo is tiny, Text is invisible and pushed down
        logo.alpha = 0f
        logo.scaleX = 0.2f
        logo.scaleY = 0.2f
        
        qcallText.alpha = 0f
        qcallText.translationY = 60f // Pushed down by 60 pixels

        // 2. THE OUTSTANDING ZOOM: Bounces past 100% and settles
        logo.animate()
            .alpha(1f) 
            .scaleX(1f) 
            .scaleY(1f) 
            .setDuration(1000)
            .setInterpolator(OvershootInterpolator(1.2f)) // The magic "bounce" factor
            .withEndAction {
                
                // 3. TEXT ANIMATION: Glides up and fades in after logo settles
                qcallText.animate()
                    .alpha(1f)
                    .translationY(0f)
                    .setDuration(600)
                    .setInterpolator(DecelerateInterpolator())
                    .withEndAction {
                        
                        // 4. TRANSITION: Wait half a second, then open the app
                        Handler(Looper.getMainLooper()).postDelayed({
                            val intent = Intent(this@SplashActivity, MainActivity::class.java)
                            startActivity(intent)
                            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                            finish() 
                        }, 500)
                    }
                    .start()
            }
            .start()
    }
}