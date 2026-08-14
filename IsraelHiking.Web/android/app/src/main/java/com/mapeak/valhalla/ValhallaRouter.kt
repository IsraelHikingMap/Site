package com.mapeak.valhalla

import android.content.Context
import com.valhalla.config.ValhallaConfigBuilder
import com.valhalla.valhalla.config.ValhallaConfigManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * A route request. The costing model and its options are taken from the stored profile named
 * [profile], so that the offline route matches the one the server would return.
 * An [elevationInterval] of 0 means no elevation is requested.
 */
data class ValhallaRouteRequest(
    val fromLat: Double,
    val fromLng: Double,
    val toLat: Double,
    val toLng: Double,
    val profile: String,
    val elevationInterval: Int = 0
)

/**
 * Runs route requests against the native valhalla engine.
 */
class ValhallaRouter(private val context: Context) {

    private val configManager by lazy { ValhallaConfigManager(context) }
    private val profiles by lazy { ValhallaProfiles(context) }

    /**
     * Returns the raw valhalla response json - the web layer decodes the shape and the elevation.
     *
     * The typed `Valhalla.route()` API cannot be used yet: its `RouteRequest` has no
     * `elevation_interval` and its `RouteLeg` has no `elevation`, so the response would drop the
     * elevation. Until https://github.com/Rallista/valhalla-mobile/issues/87 is released this calls
     * the JNI wrapper directly, which is `internal`, hence the reflection.
     */
    fun route(request: ValhallaRouteRequest, tilesDir: File): String {
        val configPath = ensureConfig(tilesDir)
        val valhallaKotlinClass = Class.forName("com.valhalla.valhalla.ValhallaKotlin")
        val valhallaKotlin = valhallaKotlinClass.getDeclaredConstructor().newInstance()
        val routeMethod = valhallaKotlinClass.getMethod("route", String::class.java, String::class.java)
        return routeMethod.invoke(valhallaKotlin, toRequestJson(request), configPath) as String
    }

    private fun toRequestJson(request: ValhallaRouteRequest): String {
        // Without the profiles there is no offline routing, the same as without tiles
        val profile = profiles.get(request.profile)
            ?: throw IllegalStateException("There is no routing profile named ${request.profile} on the device")
        val costing = profile.costing
        val locations = JSONArray()
            .put(JSONObject().put("lat", request.fromLat).put("lon", request.fromLng))
            .put(JSONObject().put("lat", request.toLat).put("lon", request.toLng))
        val json = JSONObject()
            .put("locations", locations)
            .put("costing", costing)
            .put("directions_options", JSONObject().put("units", "kilometers"))
        // Valhalla takes the options under the name of the costing model they belong to
        if (profile.costingOptions != null) {
            json.put("costing_options", JSONObject().put(costing, profile.costingOptions))
        }
        if (request.elevationInterval > 0) {
            json.put("elevation_interval", request.elevationInterval)
        }
        return json.toString()
    }

    /**
     * Writes valhalla.json if it isn't there yet. The tiles directory never changes, so the config
     * stays valid when more slices are extracted into it.
     */
    private fun ensureConfig(tilesDir: File): String {
        val configPath = configManager.getAbsolutePath()
        if (!File(configPath).exists()) {
            configManager.writeConfig(ValhallaConfigBuilder().withTileDir(tilesDir.absolutePath).build())
        }
        return configPath
    }
}
