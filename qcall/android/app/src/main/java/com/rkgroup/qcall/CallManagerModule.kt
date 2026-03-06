package com.rkgroup.qcall

import android.app.Activity
import android.app.NotificationManager
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings 
import android.telecom.TelecomManager
import android.telecom.CallAudioState
import android.util.Log
import android.provider.ContactsContract
import android.content.ContentProviderOperation
import android.util.Base64
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.rkgroup.qcall.native_telephony.QCallInCallService
import com.rkgroup.qcall.helpers.NotificationHelper 
import com.rkgroup.qcall.helpers.BlockDataBridge 
import com.rkgroup.qcall.new_overlay.CallerIdActivity 

class CallManagerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val TAG = "CallManagerModule"
    private val REQUEST_ID = 1
    private val IMPORT_REQUEST_CODE = 1002 
    private val RINGTONE_REQUEST_CODE = 1003

    private var ringtonePromise: Promise? = null 

    companion object {
        var reactAppContext: ReactApplicationContext? = null

        fun sendEvent(eventName: String, params: WritableMap?) {
            try {
                reactAppContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit(eventName, params)
            } catch (e: Exception) {}
        }
    }

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode == IMPORT_REQUEST_CODE && resultCode == Activity.RESULT_OK) {
                data?.data?.let { uri ->
                    try {
                        val importIntent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(uri, "text/x-vcard")
                            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        reactApplicationContext.startActivity(importIntent)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error importing VCF: ${e.message}")
                    }
                }
            }
            
            if (requestCode == RINGTONE_REQUEST_CODE) {
                if (resultCode == Activity.RESULT_OK) {
                    val uri: Uri? = data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
                    val map = Arguments.createMap()
                    
                    if (uri != null) {
                        val ringtone = RingtoneManager.getRingtone(reactApplicationContext, uri)
                        val name = ringtone?.getTitle(reactApplicationContext) ?: "Custom Ringtone"
                        map.putString("uri", uri.toString())
                        map.putString("name", name)
                    } else {
                        map.putString("uri", "silent")
                        map.putString("name", "Silent")
                    }
                    ringtonePromise?.resolve(map)
                } else {
                    ringtonePromise?.reject("CANCELLED", "Ringtone selection was cancelled")
                }
                ringtonePromise = null
            }
        }
    }

    init {
        reactAppContext = reactContext
        NotificationHelper.createNotificationChannel(reactContext)
        reactContext.addActivityEventListener(activityEventListener) 
    }

    override fun getName(): String = "CallManagerModule"

    // ========================================================================
    // 🟢 RINGTONE & VIBRATION NATIVE ENGINE
    // ========================================================================

    @ReactMethod
    fun openRingtonePicker(currentUriStr: String?, promise: Promise) {
        val activity = getCurrentActivity() 
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Activity doesn't exist")
            return
        }
        
        ringtonePromise = promise
        try {
            val intent = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
                putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_RINGTONE)
                putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
                putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, true)
                
                if (!currentUriStr.isNullOrEmpty() && currentUriStr != "default" && currentUriStr != "silent") {
                    putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(currentUriStr))
                }
            }
            activity.startActivityForResult(intent, RINGTONE_REQUEST_CODE)
        } catch (e: Exception) {
            ringtonePromise?.reject("PICKER_ERROR", e.message)
            ringtonePromise = null
        }
    }

    // --- CONTACT SPECIFIC SETTINGS ---
    @ReactMethod
    fun saveContactSettings(number: String, ringtoneUri: String?, ringtoneName: String?, vibrationPattern: String?, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("QCallContactSettings", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            val cleanNumber = number.replace(Regex("[^0-9+]"), "")
            
            if (ringtoneUri != null) editor.putString("ringtone_uri_$cleanNumber", ringtoneUri)
            if (ringtoneName != null) editor.putString("ringtone_name_$cleanNumber", ringtoneName)
            if (vibrationPattern != null) editor.putString("vibrate_$cleanNumber", vibrationPattern)
            
            editor.apply()
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("SAVE_ERROR", e.message) }
    }

    @ReactMethod
    fun getContactSettings(number: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("QCallContactSettings", Context.MODE_PRIVATE)
            val cleanNumber = number.replace(Regex("[^0-9+]"), "")
            
            val map = Arguments.createMap()
            map.putString("ringtoneUri", prefs.getString("ringtone_uri_$cleanNumber", "default"))
            map.putString("ringtoneName", prefs.getString("ringtone_name_$cleanNumber", "Default"))
            map.putString("vibrationPattern", prefs.getString("vibrate_$cleanNumber", "default"))
            promise.resolve(map)
        } catch (e: Exception) { promise.reject("GET_ERROR", e.message) }
    }

    // --- GLOBAL (UNIVERSAL) SETTINGS ---
    @ReactMethod
    fun saveGlobalSettings(ringtoneUri: String?, ringtoneName: String?, vibrationPattern: String?, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("QCallContactSettings", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            
            if (ringtoneUri != null) editor.putString("ringtone_uri_GLOBAL_DEFAULT", ringtoneUri)
            if (ringtoneName != null) editor.putString("ringtone_name_GLOBAL_DEFAULT", ringtoneName)
            if (vibrationPattern != null) editor.putString("vibrate_GLOBAL_DEFAULT", vibrationPattern)
            
            editor.apply()
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("SAVE_ERROR", e.message) }
    }

    @ReactMethod
    fun getGlobalSettings(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("QCallContactSettings", Context.MODE_PRIVATE)
            val map = Arguments.createMap()
            map.putString("ringtoneUri", prefs.getString("ringtone_uri_GLOBAL_DEFAULT", "default"))
            map.putString("ringtoneName", prefs.getString("ringtone_name_GLOBAL_DEFAULT", "System Default"))
            map.putString("vibrationPattern", prefs.getString("vibrate_GLOBAL_DEFAULT", "default"))
            promise.resolve(map)
        } catch (e: Exception) { promise.reject("GET_ERROR", e.message) }
    }


    // ========================================================================
    // 🟢 EXISTING APP LOGIC BELOW
    // ========================================================================

    @ReactMethod
    fun syncPremiumFeatures(features: ReadableArray, timestamp: Double) {
        val sharedPref: SharedPreferences = reactApplicationContext.getSharedPreferences("QcallPrefs", Context.MODE_PRIVATE)
        val editor = sharedPref.edit()
        
        val featureSet = mutableSetOf<String>()
        for (i in 0 until features.size()) {
            features.getString(i)?.let { featureSet.add(it) }
        }
        
        editor.putStringSet("allowedFeatures", featureSet)
        editor.putLong("lastPremiumSync", timestamp.toLong())
        editor.apply()
    }

    @ReactMethod
    fun syncBlockToNative(number: String, isBlocked: Boolean) {
        BlockDataBridge.syncBlockStatus(reactApplicationContext, number, isBlocked)
    }

    @ReactMethod
    fun isNumberBlockedNative(number: String, promise: Promise) {
        try {
            val status = BlockDataBridge.isNumberBlocked(reactApplicationContext, number)
            promise.resolve(status)
        } catch (e: Exception) {
            promise.reject("PREFS_ERROR", e.message)
        }
    }

    @ReactMethod fun answerCall() { QCallInCallService.answerCurrentCall() }
    @ReactMethod fun endCall() { QCallInCallService.hangupCurrentCall() }

    @ReactMethod
    fun startCall(number: String) {
        val context = reactApplicationContext
        val uri = Uri.parse("tel:" + number.replace("#", "%23"))
        try {
            val tm = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            tm.placeCall(uri, null)
        } catch (e: Exception) {}
    }

    @ReactMethod
    fun setMuted(muted: Boolean) { QCallInCallService.instance?.setMuted(muted) }

    @ReactMethod
    fun setSpeakerphoneOn(on: Boolean) { 
        val route = if (on) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE
        QCallInCallService.routeAudio(route)
    }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + reactApplicationContext.packageName))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun checkIsDefaultDialer(promise: Promise) {
        val context = reactApplicationContext
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
            promise.resolve(roleManager.isRoleHeld(RoleManager.ROLE_DIALER))
        } else {
            val tm = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
            promise.resolve(tm.defaultDialerPackage == context.packageName)
        }
    }

    @ReactMethod
    fun requestDefaultDialer(promise: Promise) {
        val activity = getCurrentActivity() 
        if (activity == null) {
            promise.reject("ACTIVITY_NULL", "Activity is null")
            return
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = reactApplicationContext.getSystemService(Context.ROLE_SERVICE) as RoleManager
                activity.startActivityForResult(roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER), REQUEST_ID)
            } else {
                val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER)
                intent.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, reactApplicationContext.packageName)
                activity.startActivityForResult(intent, REQUEST_ID)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun testIncomingOverlay(testNumber: String) {
        try {
            val intent = Intent(reactApplicationContext, CallerIdActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                putExtra("number", testNumber)
                putExtra("name", "Test Caller")
                putExtra("isAfterCall", false)
            }
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {}
    }

    @ReactMethod
    fun testAfterCallOverlay(testNumber: String, durationInSeconds: Int) {
        try {
            val intent = Intent(reactApplicationContext, CallerIdActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                putExtra("number", testNumber)
                putExtra("name", "Test Caller")
                putExtra("isAfterCall", true)
                putExtra("duration", durationInSeconds)
            }
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {}
    }

    @ReactMethod
    fun simulateIncomingNotification(name: String, number: String) {
        NotificationHelper.showTestNotification(reactApplicationContext, name, number)
    }

    @ReactMethod
    fun cancelIncomingNotification() {
        NotificationHelper.cancelTestNotification(reactApplicationContext)
    }

    @ReactMethod
    fun getAccountStatistics(promise: Promise) {
        try {
            val uri = ContactsContract.RawContacts.CONTENT_URI
            val projection = arrayOf(ContactsContract.RawContacts.ACCOUNT_NAME, ContactsContract.RawContacts.ACCOUNT_TYPE)
            val cursor = reactApplicationContext.contentResolver.query(uri, projection, "deleted=0", null, null)

            val accountMap = HashMap<String, Int>()
            val typeMap = HashMap<String, String>()

            cursor?.use {
                val nameIdx = it.getColumnIndex(ContactsContract.RawContacts.ACCOUNT_NAME)
                val typeIdx = it.getColumnIndex(ContactsContract.RawContacts.ACCOUNT_TYPE)

                while (it.moveToNext()) {
                    val rawName = it.getString(nameIdx)
                    val rawType = it.getString(typeIdx) ?: ""

                    val cleanName = when {
                        rawType.contains("whatsapp", ignoreCase = true) -> "WhatsApp Contacts"
                        rawType.contains("telegram", ignoreCase = true) -> "Telegram Contacts"
                        rawName == null || rawType.contains("sim", ignoreCase = true) || rawType.contains("device", ignoreCase = true) -> "Phone / SIM (Local)"
                        else -> rawName
                    }

                    accountMap[cleanName] = accountMap.getOrDefault(cleanName, 0) + 1
                    typeMap[cleanName] = rawType
                }
            }

            val writableArray = Arguments.createArray()
            for ((name, count) in accountMap) {
                val map = Arguments.createMap()
                map.putString("name", name)
                map.putString("type", typeMap[name] ?: "Unknown")
                map.putInt("count", count)
                writableArray.pushMap(map)
            }

            promise.resolve(writableArray)
        } catch (e: Exception) {
            promise.reject("STATS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getVisibleContactIds(visibleAccountNames: ReadableArray, promise: Promise) {
        try {
            val visibleSet = mutableSetOf<String>()
            for (i in 0 until visibleAccountNames.size()) {
                visibleAccountNames.getString(i)?.let { visibleSet.add(it) }
            }

            val visibleIds = mutableSetOf<String>()
            val uri = ContactsContract.RawContacts.CONTENT_URI
            val projection = arrayOf(
                ContactsContract.RawContacts.CONTACT_ID, 
                ContactsContract.RawContacts.ACCOUNT_NAME,
                ContactsContract.RawContacts.ACCOUNT_TYPE
            )
            
            val cursor = reactApplicationContext.contentResolver.query(uri, projection, "deleted=0", null, null)
            cursor?.use {
                val idIdx = it.getColumnIndex(ContactsContract.RawContacts.CONTACT_ID)
                val nameIdx = it.getColumnIndex(ContactsContract.RawContacts.ACCOUNT_NAME)
                val typeIdx = it.getColumnIndex(ContactsContract.RawContacts.ACCOUNT_TYPE)
                
                while (it.moveToNext()) {
                    val contactId = it.getString(idIdx) ?: continue
                    val rawName = it.getString(nameIdx)
                    val rawType = it.getString(typeIdx) ?: ""
                    
                    val cleanName = when {
                        rawType.contains("whatsapp", ignoreCase = true) -> "WhatsApp Contacts"
                        rawType.contains("telegram", ignoreCase = true) -> "Telegram Contacts"
                        rawName == null || rawType.contains("sim", ignoreCase = true) || rawType.contains("device", ignoreCase = true) -> "Phone / SIM (Local)"
                        else -> rawName
                    }
                    
                    if (visibleSet.contains(cleanName)) {
                        visibleIds.add(contactId)
                    }
                }
            }
            
            val resultArray = Arguments.createArray()
            visibleIds.forEach { resultArray.pushString(it) }
            promise.resolve(resultArray)
        } catch (e: Exception) {
            promise.reject("VISIBLE_IDS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun saveContactToAccount(
        firstName: String, lastName: String, phone: String, email: String,
        accountName: String?, accountType: String?, photoBase64: String?, promise: Promise
    ) {
        try {
            val ops = ArrayList<ContentProviderOperation>()

            val rawContactOp = ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
            if (accountType != "device" && accountName != null) {
                rawContactOp.withValue(ContactsContract.RawContacts.ACCOUNT_NAME, accountName)
                rawContactOp.withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, accountType)
            } else {
                rawContactOp.withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null)
                rawContactOp.withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null)
            }
            ops.add(rawContactOp.build())

            ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.GIVEN_NAME, firstName)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.FAMILY_NAME, lastName)
                .build())

            ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, phone)
                .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
                .build())

            if (email.isNotEmpty()) {
                ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                    .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                    .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE)
                    .withValue(ContactsContract.CommonDataKinds.Email.ADDRESS, email)
                    .withValue(ContactsContract.CommonDataKinds.Email.TYPE, ContactsContract.CommonDataKinds.Email.TYPE_WORK)
                    .build())
            }

            photoBase64?.let {
                if (it.isNotEmpty()) {
                    val decodedByte = Base64.decode(it, Base64.DEFAULT)
                    ops.add(ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                        .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                        .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE)
                        .withValue(ContactsContract.CommonDataKinds.Photo.PHOTO, decodedByte)
                        .build())
                }
            }

            reactApplicationContext.contentResolver.applyBatch(ContactsContract.AUTHORITY, ops)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateContactNative(contactId: String, firstName: String, lastName: String, phone: String, promise: Promise) {
        try {
            val ops = ArrayList<ContentProviderOperation>()

            val nameSelection = "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?"
            val nameArgs = arrayOf(contactId, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
            ops.add(ContentProviderOperation.newUpdate(ContactsContract.Data.CONTENT_URI)
                .withSelection(nameSelection, nameArgs)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.GIVEN_NAME, firstName)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.FAMILY_NAME, lastName)
                .build())

            val phoneSelection = "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?"
            val phoneArgs = arrayOf(contactId, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
            ops.add(ContentProviderOperation.newUpdate(ContactsContract.Data.CONTENT_URI)
                .withSelection(phoneSelection, phoneArgs)
                .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, phone)
                .build())

            reactApplicationContext.contentResolver.applyBatch(ContactsContract.AUTHORITY, ops)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun deleteContactNative(contactId: String, promise: Promise) {
        try {
            val uri = Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_URI, contactId)
            val deleted = reactApplicationContext.contentResolver.delete(uri, null, null)
            if (deleted > 0) promise.resolve(true) else promise.reject("DELETE_FAILED", "Contact not found")
        } catch (e: Exception) {
            promise.reject("DELETE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun editContactNative(contactId: String, promise: Promise) {
        try {
            val uri = Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_URI, contactId)
            val intent = Intent(Intent.ACTION_EDIT).apply {
                data = uri
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EDIT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun exportContactsNative(promise: Promise) {
        try {
            val lookupKeys = mutableListOf<String>()
            val cursor = reactApplicationContext.contentResolver.query(ContactsContract.Contacts.CONTENT_URI, arrayOf(ContactsContract.Contacts.LOOKUP_KEY), null, null, null)
            
            cursor?.use { while (it.moveToNext()) lookupKeys.add(it.getString(0)) }
            
            if (lookupKeys.isEmpty()) { promise.reject("EXPORT_EMPTY", "No contacts to export"); return }
            
            val vcardUri = Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_MULTI_VCARD_URI, Uri.encode(lookupKeys.joinToString(":")))
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = ContactsContract.Contacts.CONTENT_VCARD_TYPE
                putExtra(Intent.EXTRA_STREAM, vcardUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            
            reactApplicationContext.startActivity(Intent.createChooser(intent, "Export Contacts").apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EXPORT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun importContactsNative(promise: Promise) {
        val activity = getCurrentActivity() 
        if (activity == null) { promise.reject("ACTIVITY_NULL", "Activity doesn't exist"); return }
        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "text/x-vcard"
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            activity.startActivityForResult(intent, IMPORT_REQUEST_CODE)
            promise.resolve(true)
        } catch(e: Exception) {
            promise.reject("IMPORT_ERROR", e.message)
        }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}