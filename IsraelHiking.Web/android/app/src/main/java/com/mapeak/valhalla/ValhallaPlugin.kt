package com.mapeak.valhalla

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Offline routing using the native Valhalla engine against tiles that were downloaded and extracted
 * on the device.
 *
 * This is a self contained plugin so that it can later be moved out into its own capacitor plugin -
 * it must not depend on anything else in the app.
 */
@CapacitorPlugin(name = "Valhalla")
class ValhallaPlugin : Plugin() {

    private val tiles by lazy { ValhallaTiles(context) }
    private val router by lazy { ValhallaRouter(context) }
    private val profiles by lazy { ValhallaProfiles(context) }

    /**
     * Extracts a downloaded file of routing tiles into the shared tiles directory.
     * Extracting the files of several adjacent tiles into it is the way to route across them.
     * The tileKey identifies the tile the file belongs to, so that it can later be removed on its own.
     */
    @Suppress("unused")
    @PluginMethod
    fun extractFile(call: PluginCall) {
        val tarFileName = call.getString("tarFileName")
        if (tarFileName.isNullOrBlank()) {
            call.reject("tarFileName is required")
            return
        }
        val tileKey = call.getString("tileKey")
        if (tileKey.isNullOrBlank()) {
            call.reject("tileKey is required")
            return
        }
        try {
            ValhallaRouter.close()
            val result = tiles.extract(tarFileName, tileKey)
            call.resolve(JSObject().put("extractedFiles", result.extractedFiles).put("tilesDir", result.tilesDir))
        } catch (ex: Throwable) {
            call.rejectWith("Tile extraction failed", ex)
        }
    }

    /**
     * Keeps the routing profiles, as the app downloaded them, so that a route uses the same costing
     * options the server would have used.
     */
    @Suppress("unused")
    @PluginMethod
    fun storeProfiles(call: PluginCall) {
        val content = call.getString("profiles")
        if (content.isNullOrBlank()) {
            call.reject("profiles is required")
            return
        }
        try {
            profiles.store(content)
            call.resolve()
        } catch (ex: Throwable) {
            call.rejectWith("Failed to store the routing profiles", ex)
        }
    }

    /**
     * The keys of the tiles whose routing tiles are on the device, so that the app can tell which
     * areas it can route in without keeping a list of its own.
     */
    @Suppress("unused")
    @PluginMethod
    fun listTiles(call: PluginCall) {
        call.resolve(JSObject().put("tileKeys", JSArray(tiles.tileKeys())))
    }

    /**
     * Removes the routing tiles of a single tile, keeping the ones its neighbours share with it.
     */
    @Suppress("unused")
    @PluginMethod
    fun deleteTile(call: PluginCall) {
        val tileKey = call.getString("tileKey")
        if (tileKey.isNullOrBlank()) {
            call.reject("tileKey is required")
            return
        }
        try {
            ValhallaRouter.close()
            tiles.delete(tileKey)
            call.resolve()
        } catch (ex: Throwable) {
            call.rejectWith("Failed to delete the tiles of $tileKey", ex)
        }
    }

    /**
     * Removes all the extracted tiles.
     */
    @Suppress("unused")
    @PluginMethod
    fun clearTiles(call: PluginCall) {
        try {
            ValhallaRouter.close()
            tiles.clear()
            call.resolve()
        } catch (ex: Throwable) {
            call.rejectWith("Failed to clear the tiles", ex)
        }
    }

    /**
     * Calculates a route between two points, returns the raw valhalla response json.
     */
    @Suppress("unused")
    @PluginMethod
    fun route(call: PluginCall) {
        val fromLat = call.getDouble("fromLat") ?: return call.reject("fromLat is required")
        val fromLng = call.getDouble("fromLng") ?: return call.reject("fromLng is required")
        val toLat = call.getDouble("toLat") ?: return call.reject("toLat is required")
        val toLng = call.getDouble("toLng") ?: return call.reject("toLng is required")
        val profile = call.getString("profile")
        if (profile.isNullOrBlank()) {
            call.reject("profile is required")
            return
        }
        val elevationInterval = call.getInt("elevationInterval") ?: 0
        if (!tiles.hasTiles()) {
            call.reject("There are no valhalla tiles on the device")
            return
        }
        try {
            val raw = router.routeJson(
                ValhallaRouteRequest(
                    fromLat = fromLat,
                    fromLng = fromLng,
                    toLat = toLat,
                    toLng = toLng,
                    profile = profile,
                    elevationInterval = elevationInterval
                ),
                tiles.tilesDir()
            )
            call.resolve(JSObject().put("raw", raw))
        } catch (ex: Throwable) {
            call.rejectWith("Valhalla route failed", ex)
        }
    }

    /**
     * Rejects a call with anything that was thrown - a failure to link or to reflect is an Error
     * rather than an Exception, and it should still reach the web layer rather than take the app
     * down with it.
     */
    private fun PluginCall.rejectWith(message: String, error: Throwable) {
        reject("$message: ${error.message}", error as? Exception ?: RuntimeException(error))
    }
}
