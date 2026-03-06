package com.rkgroup.qcall.messages

import android.app.Activity
import android.app.role.RoleManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.telephony.SmsManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class DefaultSmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val dbHelper = SmsDatabaseHelper(reactContext)
    private var smsObserver: ContentObserver? = null
    private var isSyncing = false 

    override fun getName() = "DefaultSmsModule"

    @ReactMethod
    fun isDefaultSmsApp(promise: Promise) {
        try {
            val context = reactApplicationContext
            val defaultSmsPackage = Telephony.Sms.getDefaultSmsPackage(context)
            promise.resolve(defaultSmsPackage == context.packageName)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestDefaultSmsApp(promise: Promise) {
        // 🟢 FIXED: Properly calling the React Native method getCurrentActivity()
        val activity: Activity? = getCurrentActivity() 
        
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "App is in background")
            return
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = reactApplicationContext.getSystemService(Context.ROLE_SERVICE) as RoleManager
                if (roleManager.isRoleAvailable(RoleManager.ROLE_SMS)) {
                    val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS)
                    activity.startActivityForResult(intent, 999)
                }
            } else {
                val intent = Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT)
                intent.putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, reactApplicationContext.packageName)
                activity.startActivityForResult(intent, 999)
            }
            promise.resolve("PROMPT_SHOWN")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun startObservingSms() {
        if (smsObserver == null) {
            val handler = Handler(Looper.getMainLooper())
            smsObserver = object : ContentObserver(handler) {
                override fun onChange(selfChange: Boolean) {
                    super.onChange(selfChange)
                    runSyncEngine(false) 
                }
            }
            reactApplicationContext.contentResolver.registerContentObserver(
                Telephony.Sms.CONTENT_URI, true, smsObserver!!
            )
        }
    }

    @ReactMethod
    fun stopObservingSms() {
        smsObserver?.let {
            reactApplicationContext.contentResolver.unregisterContentObserver(it)
            smsObserver = null
        }
    }

    @ReactMethod
    fun syncMessages(promise: Promise) {
        runSyncEngine(true, promise)
    }

    private fun runSyncEngine(isManualTrigger: Boolean, promise: Promise? = null) {
        if (isSyncing) {
            promise?.resolve("Sync already in progress")
            return
        }
        
        Thread {
            isSyncing = true
            try {
                val context = reactApplicationContext
                val prefs = context.getSharedPreferences("qcall_prefs", Context.MODE_PRIVATE)
                val isInitialSyncDone = prefs.getBoolean("initial_sync_done", false)

                val safeLastSyncDate = Math.max(0, dbHelper.getLastSyncDate() - 60000)
                
                val selection = if (isInitialSyncDone) "date > ?" else null
                val selectionArgs = if (isInitialSyncDone) arrayOf(safeLastSyncDate.toString()) else null

                val countCursor = context.contentResolver.query(Telephony.Sms.CONTENT_URI, arrayOf("_id"), selection, selectionArgs, null)
                val totalMessagesToSync = countCursor?.count ?: 0
                countCursor?.close()

                if (totalMessagesToSync == 0) {
                    isSyncing = false
                    promise?.resolve("Already synced")
                    return@Thread
                }

                val cursor = context.contentResolver.query(
                    Telephony.Sms.CONTENT_URI,
                    arrayOf("address", "body", "date", "type"),
                    selection, selectionArgs, "date ASC" 
                )

                var syncedCount = 0
                val db = dbHelper.writableDatabase
                
                db.beginTransaction()
                try {
                    cursor?.use {
                        val addrIdx = it.getColumnIndexOrThrow("address")
                        val bodyIdx = it.getColumnIndexOrThrow("body")
                        val dateIdx = it.getColumnIndexOrThrow("date")
                        val typeIdx = it.getColumnIndexOrThrow("type")

                        while (it.moveToNext()) {
                            val rawAddress = it.getString(addrIdx) ?: "Unknown"
                            val coreId = SmsDatabaseHelper.getCore10Digits(rawAddress)
                            
                            if (coreId != "UNKNOWN") {
                                dbHelper.insertMessage(db, coreId, rawAddress, it.getString(bodyIdx) ?: "", it.getLong(dateIdx), it.getInt(typeIdx))
                                syncedCount++

                                if (!isInitialSyncDone && (syncedCount % 50 == 0 || syncedCount == totalMessagesToSync)) {
                                    val progressMap = Arguments.createMap()
                                    progressMap.putInt("synced", syncedCount)
                                    progressMap.putInt("total", totalMessagesToSync)
                                    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("onSyncProgress", progressMap)
                                }
                            }
                        }
                    }
                    db.setTransactionSuccessful() 
                } finally {
                    db.endTransaction()
                }
                
                if (!isInitialSyncDone && syncedCount > 0) prefs.edit().putBoolean("initial_sync_done", true).apply()

                if (syncedCount > 0) {
                    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("onSyncComplete", syncedCount)
                }

                promise?.resolve("Synced $syncedCount messages")
            } catch (e: Exception) { 
                promise?.reject("SYNC_ERROR", e.message) 
            } finally {
                isSyncing = false
            }
        }.start()
    }

    @ReactMethod
    fun getInboxThreads(limit: Int, promise: Promise) {
        Thread {
            try {
                val db = dbHelper.readableDatabase
                val cursor = db.rawQuery("SELECT * FROM ${SmsDatabaseHelper.TABLE_THREADS} ORDER BY ${SmsDatabaseHelper.COL_DATE} DESC LIMIT $limit", null)
                val inboxArray = Arguments.createArray()
                cursor.use {
                    while (it.moveToNext()) {
                        val map = Arguments.createMap()
                        map.putString("conversationId", it.getString(0))
                        map.putString("address", it.getString(1))
                        map.putString("body", it.getString(2))
                        map.putDouble("date", it.getLong(3).toDouble())
                        map.putInt("type", it.getInt(4))
                        inboxArray.pushMap(map)
                    }
                }
                promise.resolve(inboxArray)
            } catch (e: Exception) { promise.reject("DB_ERROR", e.message) }
        }.start()
    }

    @ReactMethod
    fun getMessagesByThread(coreNumberId: String, limit: Int, promise: Promise) {
        Thread {
            try {
                val db = dbHelper.readableDatabase
                val cursor = db.rawQuery("SELECT * FROM ${SmsDatabaseHelper.TABLE_MESSAGES} WHERE ${SmsDatabaseHelper.COL_CORE_ID} = ? ORDER BY ${SmsDatabaseHelper.COL_DATE} DESC LIMIT $limit", arrayOf(coreNumberId))
                val messagesArray = Arguments.createArray()
                cursor.use {
                    while (it.moveToNext()) {
                        val map = Arguments.createMap()
                        map.putString("_id", it.getInt(0).toString())
                        map.putString("address", it.getString(2))
                        map.putString("body", it.getString(3))
                        map.putDouble("date", it.getLong(4).toDouble())
                        map.putInt("type", it.getInt(5))
                        messagesArray.pushMap(map)
                    }
                }
                promise.resolve(messagesArray)
            } catch (e: Exception) { promise.reject("DB_ERROR", e.message) }
        }.start()
    }

    @ReactMethod
    fun sendDirectSMS(phoneNumber: String, message: String, promise: Promise) {
        try {
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) reactApplicationContext.getSystemService(SmsManager::class.java) else SmsManager.getDefault()
            val parts = smsManager.divideMessage(message)
            if (parts.size > 1) smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            else smsManager.sendTextMessage(phoneNumber, null, message, null, null)

            val timestamp = System.currentTimeMillis()

            val db = dbHelper.writableDatabase
            dbHelper.insertMessage(db, SmsDatabaseHelper.getCore10Digits(phoneNumber), phoneNumber, message, timestamp, 2)

            val isDefaultSmsApp = Telephony.Sms.getDefaultSmsPackage(reactApplicationContext) == reactApplicationContext.packageName
            if (isDefaultSmsApp) {
                try {
                    val values = ContentValues().apply {
                        put("address", phoneNumber)
                        put("body", message)
                        put("date", timestamp)
                        put("type", 2) 
                        put("read", 1)
                    }
                    reactApplicationContext.contentResolver.insert(Uri.parse("content://sms/sent"), values)
                } catch (e: Exception) { }
            }

            promise.resolve("SUCCESS")
        } catch (e: Exception) { promise.reject("SMS_FAILED", e.message) }
    }
}