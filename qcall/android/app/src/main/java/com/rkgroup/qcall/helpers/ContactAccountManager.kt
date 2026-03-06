package com.rkgroup.qcall.helpers

import android.accounts.AccountManager
import android.content.Context
import android.database.Cursor
import android.provider.ContactsContract
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray

class ContactAccountManager(private val context: Context) {

    /**
     * Fetches all unique accounts on the device and counts how many contacts
     * belong to each account (Google, Device, etc.)
     */
    fun getAccountStatistics(): WritableArray {
        val statsArray = Arguments.createArray()
        val accountManager = AccountManager.get(context)
        val accounts = accountManager.accounts

        // 1. Fetch Google and other third-party accounts
        for (account in accounts) {
            // We only care about Google accounts (or you can remove the if-statement to get WhatsApp/etc)
            if (account.type == "com.google") {
                val count = countContactsForAccount(account.name, account.type)
                val map = Arguments.createMap()
                map.putString("name", account.name) // e.g. user@gmail.com
                map.putString("type", account.type) // e.g. com.google
                map.putInt("count", count)
                statsArray.pushMap(map)
            }
        }

        // 2. Fetch local Phone/Device storage (where account name/type is NULL)
        val phoneCount = countContactsForAccount(null, null)
        val phoneMap = Arguments.createMap()
        phoneMap.putString("name", "Phone Storage")
        phoneMap.putString("type", "device")
        phoneMap.putInt("count", phoneCount)
        statsArray.pushMap(phoneMap)

        return statsArray
    }

    private fun countContactsForAccount(name: String?, type: String?): Int {
        var cursor: Cursor? = null
        return try {
            val uri = ContactsContract.RawContacts.CONTENT_URI
            val projection = arrayOf(ContactsContract.RawContacts._ID)
            
            // Logic: Filter by Name/Type. If NULL, we are looking for local device storage.
            val selection = if (name == null) {
                "${ContactsContract.RawContacts.ACCOUNT_NAME} IS NULL AND ${ContactsContract.RawContacts.ACCOUNT_TYPE} IS NULL"
            } else {
                "${ContactsContract.RawContacts.ACCOUNT_NAME} = ? AND ${ContactsContract.RawContacts.ACCOUNT_TYPE} = ?"
            }
            val selectionArgs = if (name == null) null else arrayOf(name, type)

            cursor = context.contentResolver.query(uri, projection, selection, selectionArgs, null)
            cursor?.count ?: 0
        } catch (e: Exception) {
            0
        } finally {
            cursor?.close()
        }
    }
}