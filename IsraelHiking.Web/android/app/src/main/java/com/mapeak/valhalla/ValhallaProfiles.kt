package com.mapeak.valhalla

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * A single routing profile: the valhalla costing model and the costing options to use with it, as
 * the json they were stored as, so that they can be read into the models of that costing model.
 */
data class ValhallaProfile(val costing: String, val costingOptionsJson: String?)

/**
 * The routing profiles on the device, stored next to the tiles.
 *
 * They are the same profiles the server routes with, so that a route calculated on the device
 * follows the same costing options as one calculated online. Without them there is no offline
 * routing, the same as without tiles.
 */
class ValhallaProfiles(private val context: Context) {

    companion object {
        private const val PROFILES_FILE_NAME = "valhalla_profiles.json"
        private const val COSTING_KEY = "costing"
        private const val COSTING_OPTIONS_KEY = "costingOptions"
    }

    private fun profilesFile(): File = File(context.filesDir, PROFILES_FILE_NAME)

    /**
     * Stores the profiles file as it was served, it is parsed only when a route is calculated.
     */
    fun store(profiles: String) {
        // Fail here rather than when routing, so that bad content is never stored
        JSONObject(profiles)
        profilesFile().writeText(profiles)
    }

    fun clear() {
        profilesFile().delete()
    }

    /**
     * The profile of the given name, or null when there are no profiles or no such profile in them.
     */
    fun get(name: String): ValhallaProfile? {
        val file = profilesFile()
        if (!file.exists()) {
            return null
        }
        val profile = JSONObject(file.readText()).optJSONObject(name) ?: return null
        val costing = profile.optString(COSTING_KEY)
        if (costing.isEmpty()) {
            return null
        }
        return ValhallaProfile(costing, profile.optJSONObject(COSTING_OPTIONS_KEY)?.toString())
    }
}
