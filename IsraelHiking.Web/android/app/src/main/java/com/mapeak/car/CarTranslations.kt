package com.mapeak.car

import android.content.Context
import android.util.Log
import java.io.IOException
import org.json.JSONObject

/**
 * Reads the same translation files the web app ships (bundled into the APK assets at
 * public/translations/<lang>.json) so car strings stay consistent with the rest of the app instead
 * of being duplicated in strings.xml. Mirrors the web GetTextCatalogService: keys are the English
 * text and a missing key falls back to the key itself.
 */
class CarTranslations private constructor(private val strings: Map<String, String>) {

    fun getString(key: String): String = strings[key]?.takeIf { it.isNotEmpty() } ?: key

    companion object {
        private const val LOG_TAG = "CarTranslations"
        private const val DEFAULT_FILE = "en-US"

        @Volatile private var cached: Pair<String, CarTranslations>? = null

        /**
         * Load (and cache) the translations for the given full language code, e.g. "en-US" or "he".
         * The code matches the translation file name, mirroring how the web loads them.
         */
        fun load(context: Context, languageCode: String): CarTranslations {
            cached?.let { if (it.first == languageCode) return it.second }
            val strings =
                    readAsset(context, languageCode)
                            ?: readAsset(context, DEFAULT_FILE)
                            ?: emptyMap()
            val translations = CarTranslations(strings)
            cached = languageCode to translations
            return translations
        }

        private fun readAsset(context: Context, fileName: String): Map<String, String>? {
            return try {
                context.assets.open("public/translations/$fileName.json").use { input ->
                    val json = JSONObject(input.bufferedReader().readText())
                    val map = HashMap<String, String>(json.length())
                    val keys = json.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        map[key] = json.optString(key)
                    }
                    map
                }
            } catch (e: IOException) {
                Log.w(LOG_TAG, "Could not load translations: $fileName", e)
                null
            } catch (e: Exception) {
                Log.w(LOG_TAG, "Could not parse translations: $fileName", e)
                null
            }
        }
    }
}
