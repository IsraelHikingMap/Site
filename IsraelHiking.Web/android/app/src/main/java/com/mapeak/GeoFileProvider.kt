package com.mapeak

import android.net.Uri
import androidx.core.content.FileProvider

/**
 * A [FileProvider] that knows the types of the geo files the app shares. Android has no mime type for
 * some of them, so a shared gpx file is reported as application/octet-stream and apps like WhatsApp
 * label it BIN.
 */
class GeoFileProvider : FileProvider() {
    override fun getType(uri: Uri): String? {
        val extension = uri.path?.substringAfterLast('.', "")?.lowercase()
        return MIME_TYPES[extension] ?: super.getType(uri)
    }

    companion object {
        private val MIME_TYPES = mapOf(
            "gpx" to "application/gpx+xml",
            "kml" to "application/vnd.google-earth.kml+xml",
            "kmz" to "application/vnd.google-earth.kmz"
        )
    }
}
