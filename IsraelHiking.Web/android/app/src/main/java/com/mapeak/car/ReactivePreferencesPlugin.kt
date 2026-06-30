package com.mapeak.car

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.valhalla.config.ValhallaConfigBuilder
import com.valhalla.valhalla.config.ValhallaConfigManager
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

@CapacitorPlugin(name = "ReactivePreferences")
class ReactivePreferencesPlugin : Plugin(), CapacitorStore.Listener {
    private lateinit var store: CapacitorStore

    override fun load() {
        store = CapacitorStore.get(context)
        store.addListener(this)
    }

    @Suppress("unused")
    @PluginMethod
    fun storeValue(call: PluginCall) {
        val key = call.getString("key")
        if (key.isNullOrBlank()) {
            call.reject("key is required")
            return
        }
        val value = call.getObject("value")
        if (value == null) {
            call.reject("value is required for key=$key")
            return
        }

        store.save(key, value)
        call.resolve()
    }

    /**
     * POC: untar a downloaded Valhalla area extract (an uncompressed .tar of the
     * tile tree) into a shared tile directory. Multiple areas can be extracted
     * into the same directory - tiles are keyed by grid-cell path, so disjoint
     * regions coexist; overlapping boundary tiles overwrite each other.
     */
    @Suppress("unused")
    @PluginMethod
    fun extractTiles(call: PluginCall) {
        try {
            val tarFileName = call.getString("tarFileName") ?: return call.reject("tarFileName is required")
            val tilesDirName = call.getString("tilesDir") ?: "valhalla_tiles"

            val tar = File(context.filesDir, tarFileName)
            if (!tar.exists()) {
                call.reject("Tar not found at ${tar.absolutePath}")
                return
            }
            val tilesDir = File(context.filesDir, tilesDirName)
            tilesDir.mkdirs()

            var extracted = 0
            TarArchiveInputStream(BufferedInputStream(FileInputStream(tar))).use { tarIn ->
                var entry = tarIn.nextEntry
                while (entry != null) {
                    val outFile = File(tilesDir, entry.name)
                    if (entry.isDirectory) {
                        outFile.mkdirs()
                    } else {
                        outFile.parentFile?.mkdirs()
                        FileOutputStream(outFile).use { tarIn.copyTo(it) }
                        extracted++
                    }
                    entry = tarIn.nextEntry
                }
            }

            // Tiles changed - (re)write valhalla.json now so route() doesn't have to.
            val configManager = ValhallaConfigManager(context)
            configManager.writeConfig(ValhallaConfigBuilder().withTileDir(tilesDir.absolutePath).build())

            call.resolve(JSObject().put("extractedFiles", extracted).put("tilesDir", tilesDir.absolutePath))
        } catch (ex: Exception) {
            call.reject("Tile extraction failed: ${ex.message}", ex)
        }
    }

    /**
     * POC: offline routing with the native Valhalla engine against a shared tile
     * directory (populated by extractTiles). Returns the raw Valhalla route JSON;
     * the web layer decodes the shape and reads the elevation array.
     *
     * Note: the library's typed Valhalla.route() API drops elevation (its
     * RouteLeg model has no elevation field and RouteRequest has no
     * elevation_interval), so this POC calls the lower-level native route()
     * directly - it is `internal`, hence reflection - with a hand-built request
     * that includes elevation_interval, and returns the raw JSON unchanged.
     */
    @Suppress("unused")
    @PluginMethod
    fun route(call: PluginCall) {
        try {
            val tilesDirName = call.getString("tilesDir") ?: "valhalla_tiles"
            val fromLat = call.getDouble("fromLat") ?: return call.reject("fromLat is required")
            val fromLng = call.getDouble("fromLng") ?: return call.reject("fromLng is required")
            val toLat = call.getDouble("toLat") ?: return call.reject("toLat is required")
            val toLng = call.getDouble("toLng") ?: return call.reject("toLng is required")
            val costing = call.getString("costing") ?: "auto"
            val elevationInterval = call.getInt("elevationInterval") ?: 30

            val tilesDir = File(context.filesDir, tilesDirName)
            if (!tilesDir.exists()) {
                call.reject("Valhalla tiles directory not found at ${tilesDir.absolutePath}")
                return
            }

            // valhalla.json is written by extractTiles; only write here if it's missing
            // (e.g. tiles left over from an older build). The native engine re-reads it each call.
            val configManager = ValhallaConfigManager(context)
            if (!File(configManager.getAbsolutePath()).exists()) {
                configManager.writeConfig(ValhallaConfigBuilder().withTileDir(tilesDir.absolutePath).build())
            }

            val requestJson = (
                """{"locations":[{"lat":$fromLat,"lon":$fromLng},{"lat":$toLat,"lon":$toLng}],""" +
                """"costing":"$costing","directions_options":{"units":"kilometers"},""" +
                """"elevation_interval":$elevationInterval}"""
            )

            // Reflection into the internal ValhallaKotlin JNI wrapper to get raw JSON.
            val valhallaKotlinClass = Class.forName("com.valhalla.valhalla.ValhallaKotlin")
            val valhallaKotlin = valhallaKotlinClass.getDeclaredConstructor().newInstance()
            val routeMethod = valhallaKotlinClass.getMethod("route", String::class.java, String::class.java)
            val raw = routeMethod.invoke(valhallaKotlin, requestJson, configManager.getAbsolutePath()) as String

            call.resolve(JSObject().put("raw", raw))
        } catch (ex: Exception) {
            call.reject("Valhalla route failed: ${ex.message}", ex)
        }
    }

    override fun onCarStoreUpdated(key: String) {
        notifyListeners(key, store.load(key))
    }
}
