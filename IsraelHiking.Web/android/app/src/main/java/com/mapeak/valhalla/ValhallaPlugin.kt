package com.mapeak.valhalla

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

    /**
     * Extracts a downloaded slice of routing tiles into the shared tiles directory.
     * Extracting several adjacent slices into the same directory is the way to route across them.
     * The sliceId identifies the slice so that it can later be removed on its own.
     */
    @Suppress("unused")
    @PluginMethod
    fun extractTiles(call: PluginCall) {
        val tarFileName = call.getString("tarFileName")
        if (tarFileName.isNullOrBlank()) {
            call.reject("tarFileName is required")
            return
        }
        val sliceId = call.getString("sliceId")
        if (sliceId.isNullOrBlank()) {
            call.reject("sliceId is required")
            return
        }
        try {
            val result = tiles.extract(tarFileName, sliceId)
            call.resolve(JSObject().put("extractedFiles", result.extractedFiles).put("tilesDir", result.tilesDir))
        } catch (ex: Exception) {
            call.reject("Tile extraction failed: ${ex.message}", ex)
        }
    }

    /**
     * Whether there are any extracted tiles on the device, i.e. whether offline routing can be attempted.
     */
    @Suppress("unused")
    @PluginMethod
    fun hasTiles(call: PluginCall) {
        call.resolve(JSObject().put("hasTiles", tiles.hasTiles()))
    }

    /**
     * Removes the tiles of a single slice, keeping the tiles that its neighbours share with it.
     */
    @Suppress("unused")
    @PluginMethod
    fun deleteTiles(call: PluginCall) {
        val sliceId = call.getString("sliceId")
        if (sliceId.isNullOrBlank()) {
            call.reject("sliceId is required")
            return
        }
        try {
            tiles.delete(sliceId)
            call.resolve()
        } catch (ex: Exception) {
            call.reject("Failed to delete the tiles of $sliceId: ${ex.message}", ex)
        }
    }

    /**
     * Removes all the extracted tiles.
     */
    @Suppress("unused")
    @PluginMethod
    fun clearTiles(call: PluginCall) {
        try {
            tiles.clear()
            call.resolve()
        } catch (ex: Exception) {
            call.reject("Failed to clear the tiles: ${ex.message}", ex)
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
        val costing = call.getString("costing")
        if (costing.isNullOrBlank()) {
            call.reject("costing is required")
            return
        }
        val costingOptions = call.getObject("costingOptions")?.toString()
        val elevationInterval = call.getInt("elevationInterval") ?: 0
        if (!tiles.hasTiles()) {
            call.reject("There are no valhalla tiles on the device")
            return
        }
        try {
            val raw = router.route(
                ValhallaRouteRequest(
                    fromLat = fromLat,
                    fromLng = fromLng,
                    toLat = toLat,
                    toLng = toLng,
                    costing = costing,
                    costingOptionsJson = costingOptions,
                    elevationInterval = elevationInterval
                ),
                tiles.tilesDir()
            )
            call.resolve(JSObject().put("raw", raw))
        } catch (ex: Exception) {
            call.reject("Valhalla route failed: ${ex.message}", ex)
        }
    }
}
