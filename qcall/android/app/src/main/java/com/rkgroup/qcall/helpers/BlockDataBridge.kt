package com.rkgroup.qcall.helpers

import android.content.Context
import android.content.SharedPreferences

object BlockDataBridge {
    private const val PREF_NAME = "BlockedNumbersPrefs"

    // 🟢 Checks if the number is in the Kotlin-accessible list
    // This is used by the CallScreeningService to decline calls in real-time.
    fun isNumberBlocked(context: Context, number: String?): Boolean {
        if (number == null) return false
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        
        // Clean the incoming number to its last 10 digits for consistent matching
        val cleanNum = number.replace(Regex("[^0-9]"), "").takeLast(10)
        return prefs.getBoolean(cleanNum, false)
    }

    // 🔴 Updates the list from the React Native Module
    // When you block/unblock in the app, this updates the local XML file.
    fun syncBlockStatus(context: Context, number: String, isBlocked: Boolean) {
        val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        val cleanNum = number.replace(Regex("[^0-9]"), "").takeLast(10)
        
        if (isBlocked) {
            prefs.edit().putBoolean(cleanNum, true).apply()
        } else {
            // Remove the number entirely if unblocked to keep the file clean
            prefs.edit().remove(cleanNum).apply()
        }
    }
}