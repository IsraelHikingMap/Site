package com.mapeak

import android.net.Uri
import androidx.core.content.FileProvider

/**
 * A [FileProvider] that knows the type of a gpx file. Android has no mime type for the gpx extension,
 * so a shared gpx file is reported as application/octet-stream and apps like WhatsApp label it BIN.
 */
class GeoFileProvider : FileProvider() {
    override fun getType(uri: Uri): String? {
        if (uri.path?.endsWith(".gpx", ignoreCase = true) == true) {
            return "application/gpx+xml"
        }
        return super.getType(uri)
    }
}
