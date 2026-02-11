package com.rkgroup.qcall.messages

import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (Telephony.Sms.Intents.SMS_DELIVER_ACTION == intent.action) {
            try {
                // 1. Extract messages from the Intent
                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                
                if (messages.isNullOrEmpty()) return

                // 2. Loop through messages (Long SMS can be split into parts)
                for (sms in messages) {
                    if (sms == null) continue

                    // 3. Prepare data to save
                    val values = ContentValues().apply {
                        put(Telephony.Sms.ADDRESS, sms.displayOriginatingAddress)
                        put(Telephony.Sms.BODY, sms.displayMessageBody)
                        put(Telephony.Sms.DATE, System.currentTimeMillis())
                        put(Telephony.Sms.READ, 0) // 0 = Unread, 1 = Read
                        put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_INBOX)
                        put(Telephony.Sms.SEEN, 0)
                    }

                    // 4. Insert into System SMS Database
                    val uri = context.contentResolver.insert(Telephony.Sms.Inbox.CONTENT_URI, values)
                    
                    if (uri != null) {
                        Log.d("QCall_SMS", "SMS Saved: ${sms.displayOriginatingAddress}")
                    }
                }
            } catch (e: Exception) {
                Log.e("QCall_SMS", "Error saving SMS", e)
            }
        }
    }
}