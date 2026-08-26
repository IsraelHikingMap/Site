package com.mapeak.valhalla

import android.content.Context
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.valhalla.api.models.AutoCostingOptions
import com.valhalla.api.models.BicycleCostingOptions
import com.valhalla.api.models.CostingModel
import com.valhalla.api.models.CostingOptions
import com.valhalla.api.models.DirectionsOptions
import com.valhalla.api.models.DistanceUnit
import com.valhalla.api.models.MapMatchCostingModel
import com.valhalla.api.models.MapMatchRequest
import com.valhalla.api.models.MapMatchRouteResponse
import com.valhalla.api.models.MapMatchWaypoint
import com.valhalla.api.models.PedestrianCostingOptions
import com.valhalla.api.models.RouteRequest
import com.valhalla.api.models.RouteResponse
import com.valhalla.api.models.RoutingWaypoint
import com.valhalla.api.models.ValhallaLanguages
import com.valhalla.config.models.ValhallaConfig
import com.valhalla.valhalla.Valhalla
import com.valhalla.valhalla.ValhallaResponse
import org.json.JSONObject
import java.io.File

/** A point along a route, in the order the app uses. */
data class ValhallaPoint(val lat: Double, val lng: Double)

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
 * A request to match [points] to the road network and get the turns along them, in [language] -
 * a tag such as "en-US", which is used only if the engine has that language. As with a route, the
 * costing model and its options are taken from the stored profile named [profile].
 */
data class ValhallaTraceRequest(
    val points: List<ValhallaPoint>,
    val profile: String,
    val language: String? = null
)

/**
 * Runs route and map match requests against the native valhalla engine.
 */
class ValhallaRouter(context: Context) {

    companion object {
        /** The plugin's own copy, the app hands it the file it downloaded */
        private const val CONFIGURATION_FILE_NAME = "valhalla_configuration.json"

        private const val MJOLNIR_KEY = "mjolnir"
        private const val TILE_DIR_KEY = "tile_dir"

        /**
         * Setting the engine up reads the tiles that are on the device, which is far too slow to
         * do on every request, so it is opened once and kept for the whole process - there is a
         * single set of tiles, and every caller routes against it.
         *
         * It is guarded because a route can be asked for from more than one thread - the web layer
         * and android auto - and because closing it while a route is being calculated would take
         * the native side down with it.
         */
        private val engineLock = Any()
        private var valhalla: Valhalla? = null

        /**
         * Lets go of the open engine, the next request opens a new one. This is what makes tiles
         * that were just added or removed take effect: the engine reads the tiles it has when it
         * is opened, and never looks at the directory again.
         */
        fun close() {
            synchronized(engineLock) {
                valhalla?.close()
                valhalla = null
            }
        }
    }

    private val context = context.applicationContext
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val profiles by lazy { ValhallaProfiles(this.context) }

    /**
     * Returns the valhalla response json - the web layer decodes the shape and the elevation.
     */
    fun routeJson(request: ValhallaRouteRequest, tilesDir: File): String =
        moshi.adapter(RouteResponse::class.java).toJson(route(request, tilesDir))

    /**
     * Calculates a route between the two points of the request.
     */
    fun route(request: ValhallaRouteRequest, tilesDir: File): RouteResponse =
        synchronized(engineLock) {
            when (val response = engine(tilesDir).route(toRouteRequest(request))) {
                is ValhallaResponse.Json -> response.jsonResponse
                else -> throw IllegalStateException("The routing engine did not answer with a route")
            }
        }

    /**
     * Matches the points of the request to the road network, and returns the trip along them with
     * its turn by turn maneuvers.
     */
    fun traceRoute(request: ValhallaTraceRequest, tilesDir: File): MapMatchRouteResponse =
        synchronized(engineLock) { engine(tilesDir).traceRoute(toMapMatchRequest(request)) }

    /**
     * Keeps the configuration as it was downloaded, it is only read when the engine is opened.
     */
    fun storeConfiguration(configuration: String) {
        // Fail here rather than when routing, so that content that can not be read is never kept
        JSONObject(configuration)
        File(context.filesDir, CONFIGURATION_FILE_NAME).writeText(configuration)
        // Whatever is open was set up with the configuration this one replaces
        close()
    }

    private fun engine(tilesDir: File): Valhalla =
        valhalla ?: Valhalla(context, engineConfig(tilesDir)).also { valhalla = it }

    /**
     * The configuration the engine is opened with: the one that was downloaded with the offline
     * maps, which is the very same one the server runs with, with the only thing it can not know -
     * where the tiles are on this device - filled in. Without it, as without tiles, there is no
     * offline routing.
     */
    private fun engineConfig(tilesDir: File): ValhallaConfig {
        val downloaded = File(context.filesDir, CONFIGURATION_FILE_NAME)
        if (!downloaded.exists()) {
            throw IllegalStateException("The routing configuration was not downloaded to the device")
        }
        val config = JSONObject(downloaded.readText())
        val mjolnir = config.optJSONObject(MJOLNIR_KEY)
            ?: JSONObject().also { config.put(MJOLNIR_KEY, it) }
        mjolnir.put(TILE_DIR_KEY, tilesDir.absolutePath)
        return moshi.adapter(ValhallaConfig::class.java).fromJson(config.toString())
            ?: throw IllegalStateException("The routing configuration is empty")
    }

    private fun toRouteRequest(request: ValhallaRouteRequest): RouteRequest {
        val profile = profile(request.profile)
        val costing = CostingModel.entries.firstOrNull { it.value == profile.costing }
            ?: throw IllegalStateException("${profile.costing} is not a valhalla costing model")
        return RouteRequest(
            locations =
                listOf(
                    RoutingWaypoint(lat = request.fromLat, lon = request.fromLng),
                    RoutingWaypoint(lat = request.toLat, lon = request.toLng)
                ),
            costing = costing,
            costingOptions = toCostingOptions(profile),
            units = DistanceUnit.km,
            elevationInterval = request.elevationInterval.toDouble()
        )
    }

    private fun toMapMatchRequest(request: ValhallaTraceRequest): MapMatchRequest {
        val profile = profile(request.profile)
        val costing = MapMatchCostingModel.entries.firstOrNull { it.value == profile.costing }
            ?: throw IllegalStateException("${profile.costing} can not be used to match a trace")
        val lastIndex = request.points.size - 1
        return MapMatchRequest(
            // Only the ends are break points, so that the trace comes back as a single leg with one
            // depart and one arrive, and the rest are snapped through - as the server asks for it
            shape = request.points.mapIndexed { index, point ->
                MapMatchWaypoint(
                    lat = point.lat,
                    lon = point.lng,
                    type = if (index == 0 || index == lastIndex) MapMatchWaypoint.Type.`break`
                    else MapMatchWaypoint.Type.via
                )
            },
            costing = costing,
            costingOptions = toCostingOptions(profile),
            shapeMatch = MapMatchRequest.ShapeMatch.map_snap,
            directionsOptions = DirectionsOptions(
                units = DistanceUnit.km,
                language = toLanguage(request.language)
            )
        )
    }

    /** Without the profiles there is no offline routing, the same as without tiles */
    private fun profile(name: String): ValhallaProfile = profiles.get(name)
        ?: throw IllegalStateException("There is no routing profile named $name on the device")

    /**
     * The options of a profile belong to the costing model they were written for, and are read
     * strictly: an option the models do not know of is a mismatch between the profiles file and the
     * api, which should be fixed rather than quietly dropped, so it fails the request.
     */
    private fun toCostingOptions(profile: ValhallaProfile): CostingOptions? {
        val optionsJson = profile.costingOptionsJson ?: return null
        return when (profile.costing) {
            CostingModel.pedestrian.value -> CostingOptions(pedestrian = parse<PedestrianCostingOptions>(optionsJson))
            CostingModel.bicycle.value -> CostingOptions(bicycle = parse<BicycleCostingOptions>(optionsJson))
            CostingModel.auto.value -> CostingOptions(auto = parse<AutoCostingOptions>(optionsJson))
            else -> throw IllegalStateException("There are no costing options here for ${profile.costing}")
        }
    }

    /**
     * The engine only speaks the languages it was built with, and instructions in a language it
     * does not know are not better than english ones, so a language it has no name for is left out
     * and valhalla answers in its own default.
     */
    private fun toLanguage(language: String?): ValhallaLanguages? {
        if (language == null) {
            return null
        }
        return ValhallaLanguages.entries.firstOrNull { it.value == language }
            ?: ValhallaLanguages.entries.firstOrNull { it.value.substringBefore('-') == language.substringBefore('-') }
    }

    private inline fun <reified T> parse(json: String): T {
        return moshi.adapter(T::class.java).failOnUnknown().fromJson(json)
            ?: throw IllegalStateException("Could not read the costing options of the profile")
    }
}
