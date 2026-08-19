package com.mapeak.valhalla

import android.content.Context
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.valhalla.api.models.AutoCostingOptions
import com.valhalla.api.models.BicycleCostingOptions
import com.valhalla.api.models.CostingModel
import com.valhalla.api.models.CostingOptions
import com.valhalla.api.models.DistanceUnit
import com.valhalla.api.models.PedestrianCostingOptions
import com.valhalla.api.models.RouteRequest
import com.valhalla.api.models.RoutingWaypoint
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

    companion object {
        /** The plugin's own copy, the app hands it the file it downloaded */
        private const val CONFIGURATION_FILE_NAME = "valhalla_configuration.json"

        /** The configuration the engine is run with, the downloaded one with the tiles directory in it */
        private const val ENGINE_CONFIGURATION_FILE_NAME = "valhalla.json"

        private const val MJOLNIR_KEY = "mjolnir"
        private const val TILE_DIR_KEY = "tile_dir"
    }

    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val profiles by lazy { ValhallaProfiles(context) }


    /**
     * Returns the valhalla response json - the web layer decodes the shape and the elevation.
     */
    fun route(request: ValhallaRouteRequest, tilesDir: File): String {
        val requestJson = moshi.adapter(RouteRequest::class.java).toJson(toRouteRequest(request))
        return routeRaw(requestJson, ensureConfig(tilesDir))
    }

    /**
     * Sends an already serialized request to the native engine and returns its raw response.
     *
     * `Valhalla.route()` would be the way to do this, but the published valhalla-mobile is built
     * against valhalla-models 0.1.1, where `RouteRequest` still had a nested `DirectionsOptions`
     * that 0.2.0 flattened away, so calling it against any current models throws
     * NoSuchMethodError - see https://github.com/Rallista/valhalla-mobile/issues/60. The request
     * above is built and serialized here from the very same models, so nothing is skipped or
     * guessed, and this only reaches valhalla's own entry point, which is `internal`.
     *
     * Once valhalla-mobile is released against current models this whole method goes away, and
     * route() above becomes:
     *     val response = Valhalla(context, config).route(toRouteRequest(request))
     */
    private fun routeRaw(requestJson: String, configPath: String): String {
        val valhallaKotlinClass = Class.forName("com.valhalla.valhalla.ValhallaKotlin")
        val valhallaKotlin = valhallaKotlinClass.getDeclaredConstructor().newInstance()
        val routeMethod = valhallaKotlinClass.getMethod("route", String::class.java, String::class.java)
        return routeMethod.invoke(valhallaKotlin, requestJson, configPath) as String
    }

    /**
     * Keeps the configuration as it was downloaded, it is only read when a route is calculated.
     */
    fun storeConfiguration(configuration: String) {
        // Fail here rather than when routing, so that content that can not be read is never kept
        JSONObject(configuration)
        File(context.filesDir, CONFIGURATION_FILE_NAME).writeText(configuration)
    }

    /**
     * The configuration the engine is run with: the one that was downloaded with the offline maps,
     * which is the very same one the server runs with, with the only thing it can not know - where
     * the tiles are on this device - filled in. Without it, as without tiles, there is no offline
     * routing.
     *
     * It is written on every route rather than kept, so that a configuration that was downloaded
     * again takes effect without having to notice that it changed.
     */
    private fun ensureConfig(tilesDir: File): String {
        val downloaded = File(context.filesDir, CONFIGURATION_FILE_NAME)
        if (!downloaded.exists()) {
            throw IllegalStateException("The routing configuration was not downloaded to the device")
        }
        val config = JSONObject(downloaded.readText())
        config.getJSONObject(MJOLNIR_KEY).put(TILE_DIR_KEY, tilesDir.absolutePath)
        val engineConfig = File(context.filesDir, ENGINE_CONFIGURATION_FILE_NAME)
        engineConfig.writeText(config.toString())
        return engineConfig.absolutePath
    }

    private fun toRouteRequest(request: ValhallaRouteRequest): RouteRequest {
        // Without the profiles there is no offline routing, the same as without tiles
        val profile = profiles.get(request.profile)
            ?: throw IllegalStateException("There is no routing profile named ${request.profile} on the device")
        val costing = CostingModel.entries.firstOrNull { it.value == profile.costing }
            ?: throw IllegalStateException("${profile.costing} is not a valhalla costing model")
        return RouteRequest(
            locations =
                listOf(
                    RoutingWaypoint(lat = request.fromLat, lon = request.fromLng),
                    RoutingWaypoint(lat = request.toLat, lon = request.toLng)
                ),
            costing = costing,
            costingOptions = toCostingOptions(costing, profile.costingOptionsJson),
            units = DistanceUnit.km,
            elevationInterval = request.elevationInterval.toDouble()
        )
    }

    /**
     * The options of a profile belong to the costing model they were written for, and are read
     * strictly: an option the models do not know of is a mismatch between the profiles file and the
     * api, which should be fixed rather than quietly dropped, so it fails the request.
     */
    private fun toCostingOptions(costing: CostingModel, optionsJson: String?): CostingOptions? {
        if (optionsJson == null) {
            return null
        }
        return when (costing) {
            CostingModel.pedestrian -> CostingOptions(pedestrian = parse<PedestrianCostingOptions>(optionsJson))
            CostingModel.bicycle -> CostingOptions(bicycle = parse<BicycleCostingOptions>(optionsJson))
            CostingModel.auto -> CostingOptions(auto = parse<AutoCostingOptions>(optionsJson))
            else -> throw IllegalStateException("There are no costing options here for ${costing.value}")
        }
    }

    private inline fun <reified T> parse(json: String): T {
        return moshi.adapter(T::class.java).failOnUnknown().fromJson(json)
            ?: throw IllegalStateException("Could not read the costing options of the profile")
    }
}
