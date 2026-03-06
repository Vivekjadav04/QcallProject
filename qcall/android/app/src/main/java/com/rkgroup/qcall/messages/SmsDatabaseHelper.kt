package com.rkgroup.qcall.messages

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class SmsDatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "QCallShadowSms.db"
        // Bumped to version 3 to force a fresh, clean rebuild of your tables
        private const val DATABASE_VERSION = 3

        const val TABLE_MESSAGES = "messages"
        const val TABLE_THREADS = "threads"
        
        const val COL_CORE_ID = "core_id" 
        const val COL_RAW_ADDRESS = "raw_address"
        const val COL_BODY = "body"
        const val COL_DATE = "date"
        const val COL_TYPE = "type"

        fun getCore10Digits(phone: String?): String {
            if (phone == null) return "UNKNOWN"
            val digitsOnly = phone.replace(Regex("\\D"), "")
            if (digitsOnly.length >= 10) return digitsOnly.takeLast(10)
            return if (digitsOnly.isEmpty()) phone else digitsOnly
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE $TABLE_MESSAGES (
                _id INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_CORE_ID TEXT, $COL_RAW_ADDRESS TEXT, $COL_BODY TEXT,
                $COL_DATE INTEGER, $COL_TYPE INTEGER
            )
        """)
        db.execSQL("""
            CREATE TABLE $TABLE_THREADS (
                $COL_CORE_ID TEXT PRIMARY KEY,
                $COL_RAW_ADDRESS TEXT, $COL_BODY TEXT,
                $COL_DATE INTEGER, $COL_TYPE INTEGER
            )
        """)
        db.execSQL("CREATE INDEX idx_core_id ON $TABLE_MESSAGES($COL_CORE_ID)")
        db.execSQL("CREATE INDEX idx_date ON $TABLE_MESSAGES($COL_DATE)") 
        db.execSQL("CREATE INDEX idx_thread_date ON $TABLE_THREADS($COL_DATE)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_MESSAGES")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_THREADS")
        onCreate(db)
    }

    fun insertMessage(db: SQLiteDatabase, coreId: String, rawAddress: String, body: String, date: Long, type: Int) {
        // 🚀 THE FUZZY MATCH FIX: Check if this EXACT message was saved in the last 5 seconds (5000ms)
        // This completely eliminates duplicates caused by Android network delays!
        val cursor = db.rawQuery(
            "SELECT _id FROM $TABLE_MESSAGES WHERE $COL_CORE_ID = ? AND $COL_BODY = ? AND $COL_TYPE = ? AND ABS($COL_DATE - ?) < 5000",
            arrayOf(coreId, body, type.toString(), date.toString())
        )
        val exists = cursor.count > 0
        cursor.close()

        // Only save the message if it is a truly new message
        if (!exists) {
            val values = ContentValues().apply {
                put(COL_CORE_ID, coreId)
                put(COL_RAW_ADDRESS, rawAddress)
                put(COL_BODY, body)
                put(COL_DATE, date)
                put(COL_TYPE, type)
            }
            db.insert(TABLE_MESSAGES, null, values)
            db.insertWithOnConflict(TABLE_THREADS, null, values, SQLiteDatabase.CONFLICT_REPLACE)
        }
    }

    fun getLastSyncDate(): Long {
        val db = this.readableDatabase
        val cursor = db.rawQuery("SELECT MAX($COL_DATE) FROM $TABLE_MESSAGES", null)
        var lastDate = 0L
        if (cursor.moveToFirst()) lastDate = cursor.getLong(0)
        cursor.close()
        return lastDate
    }
}