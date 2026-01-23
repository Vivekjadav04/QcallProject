package com.rkgroup.qcall.helpers

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.net.Uri
import android.provider.ContactsContract
import java.io.InputStream
import java.util.Random

object ContactHelper {

    data class ContactInfo(
        val name: String,
        val photo: Bitmap?,
        val isUnknown: Boolean
    )

    // 🟢 FAST LOOKUP ENGINE
    fun getContactInfo(context: Context, phoneNumber: String?): ContactInfo {
        if (phoneNumber.isNullOrEmpty()) {
            return ContactInfo("Unknown", null, true)
        }

        val resolver = context.contentResolver
        // Optimized URI for phone lookup
        val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber))
        val projection = arrayOf(
            ContactsContract.PhoneLookup.DISPLAY_NAME,
            ContactsContract.PhoneLookup.PHOTO_URI
        )

        var name = "Unknown"
        var photoUriStr: String? = null
        var isUnknown = true

        try {
            val cursor = resolver.query(uri, projection, null, null, null)
            if (cursor != null) {
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME)
                    val photoIndex = cursor.getColumnIndex(ContactsContract.PhoneLookup.PHOTO_URI)
                    
                    if (nameIndex >= 0) name = cursor.getString(nameIndex)
                    if (photoIndex >= 0) photoUriStr = cursor.getString(photoIndex)
                    isUnknown = false
                }
                cursor.close()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 1. Try to load Real Photo High Res
        var bitmap: Bitmap? = null
        if (photoUriStr != null) {
            try {
                val imageStream: InputStream? = resolver.openInputStream(Uri.parse(photoUriStr))
                bitmap = BitmapFactory.decodeStream(imageStream)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // 2. Fallback: If totally unknown, set name to number
        if (isUnknown) {
            name = phoneNumber
        }

        // 3. Fallback: Generate Professional Letter Avatar if no real photo
        if (bitmap == null) {
            bitmap = generateLetterAvatar(if (isUnknown) "?" else name)
        }

        return ContactInfo(name, bitmap, isUnknown)
    }

    private fun generateLetterAvatar(name: String): Bitmap {
        val width = 200
        val height = 200
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint()

        // Professional Pastel Colors (Material Design)
        val colors = arrayOf(
            "#EF5350", "#EC407A", "#AB47BC", "#7E57C2", "#5C6BC0",
            "#42A5F5", "#29B6F6", "#26C6DA", "#26A69A", "#66BB6A",
            "#FFA726", "#FF7043", "#8D6E63", "#78909C"
        )
        // Consistent color for same name
        val colorIndex = Math.abs(name.hashCode()) % colors.size
        paint.color = Color.parseColor(colors[colorIndex])
        paint.style = Paint.Style.FILL
        paint.isAntiAlias = true
        
        // Draw Circle
        canvas.drawCircle(width / 2f, height / 2f, width / 2f, paint)

        // Draw Letter
        paint.color = Color.WHITE
        paint.textSize = 100f
        paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        paint.textAlign = Paint.Align.CENTER

        val letter = if (name.isNotEmpty()) name.substring(0, 1).uppercase() else "?"
        
        // Center Text Vertically
        val bounds = Rect()
        paint.getTextBounds(letter, 0, letter.length, bounds)
        val y = (height / 2f) + (bounds.height() / 2f)

        canvas.drawText(letter, width / 2f, y, paint)

        return bitmap
    }
}