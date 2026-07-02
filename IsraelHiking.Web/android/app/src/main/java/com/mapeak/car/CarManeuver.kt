package com.mapeak.car

import androidx.car.app.navigation.model.Maneuver
import kotlin.math.abs
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import org.maplibre.android.geometry.LatLng
import org.maplibre.geojson.Point
import org.maplibre.turf.TurfConstants
import org.maplibre.turf.TurfMeasurement

/**
 * A turn along the route. Android for Cars requires navigation apps to provide turn-by-turn
 * directions. These come from the map-match backend when available (see [fromInstructions]) and
 * otherwise fall back to turns synthesized from the polyline geometry (see [CarManeuverGenerator]).
 * [cue] is the instruction text: backend instructions are already localized and used as-is, while
 * synthesized cues are English [CarTranslations] keys (translation falls back to the key itself).
 * [distanceAlongRouteM] is measured from the start of the route. [roundaboutExitNumber] is set only
 * for roundabout maneuvers (Android requires it to render the roundabout), null otherwise.
 */
data class CarManeuver(
        val type: Int,
        val cue: String,
        val distanceAlongRouteM: Double,
        val roundaboutExitNumber: Int? = null
) {

    fun toJson(): JSONObject =
            JSONObject()
                    .put("type", type)
                    .put("cue", cue)
                    .put("distanceAlongRouteM", distanceAlongRouteM)
                    .put("roundaboutExitNumber", roundaboutExitNumber)

    companion object {
        @Throws(JSONException::class)
        fun fromJson(json: JSONObject): CarManeuver =
                CarManeuver(
                        json.getInt("type"),
                        json.getString("cue"),
                        json.getDouble("distanceAlongRouteM"),
                        if (json.isNull("roundaboutExitNumber")) null
                        else json.getInt("roundaboutExitNumber")
                )

        /**
         * Build maneuvers from the v2 `instructions` array returned by the map-match endpoint
         * (requested with instructionsFormat=v2). Each instruction carries the length of its own
         * segment in `distanceMeters`; the maneuver is performed at the start of that segment, so
         * its distance-from-start is the running total of the preceding instructions' lengths.
         * `text` is already localized by the backend (the language is sent with the request), so it
         * is used directly as the cue.
         */
        fun fromInstructions(instructions: JSONArray): List<CarManeuver> {
            val maneuvers = ArrayList<CarManeuver>(instructions.length())
            var cumulative = 0.0
            for (i in 0 until instructions.length()) {
                val instruction = instructions.optJSONObject(i) ?: continue
                val type = instruction.optString("type")
                val text = instruction.optString("text")
                val exitNumber =
                        if (instruction.isNull("roundaboutExitNumber")) null
                        else instruction.optInt("roundaboutExitNumber")
                maneuvers.add(toManeuver(type, text, cumulative, exitNumber))
                cumulative += instruction.optDouble("distanceMeters", 0.0)
            }
            return maneuvers
        }

        /**
         * Builds a single maneuver from a v2 instruction. A roundabout needs a valid exit number
         * (>= 1) to render, so without one it falls back to a plain straight maneuver rather than
         * crashing the maneuver builder. The backend does not provide a circulation direction (this
         * is a worldwide app), and only the exit number is shown, so the arbitrary-but-required
         * direction is left at counter-clockwise.
         */
        private fun toManeuver(
                type: String,
                text: String,
                distanceAlongRouteM: Double,
                exitNumber: Int?
        ): CarManeuver {
            val maneuverType = RouteManeuverType.fromWire(type)
            if (maneuverType == RouteManeuverType.ROUNDABOUT) {
                return if (exitNumber != null && exitNumber >= 1) {
                    CarManeuver(maneuverType.androidType, text, distanceAlongRouteM, exitNumber)
                } else {
                    CarManeuver(Maneuver.TYPE_STRAIGHT, text, distanceAlongRouteM)
                }
            }
            return CarManeuver(maneuverType.androidType, text, distanceAlongRouteM)
        }
    }
}

/**
 * The normalized, engine-agnostic maneuver kinds shared with the backend v2 instructions model
 * (mirrors IsraelHiking.Common.Api.ManeuverType), each paired with the Android for Cars maneuver
 * type it renders as. Kinds without a dedicated turn (continue/roundabout-exit/ferry-exit, and any
 * unknown future kind) render as a plain straight maneuver.
 */
private enum class RouteManeuverType(val wire: String, val androidType: Int) {
    DEPART("depart", Maneuver.TYPE_DEPART),
    ARRIVE("arrive", Maneuver.TYPE_DESTINATION),
    SLIGHT_LEFT("slight-left", Maneuver.TYPE_TURN_SLIGHT_LEFT),
    LEFT("left", Maneuver.TYPE_TURN_NORMAL_LEFT),
    SHARP_LEFT("sharp-left", Maneuver.TYPE_TURN_SHARP_LEFT),
    UTURN_LEFT("uturn-left", Maneuver.TYPE_U_TURN_LEFT),
    SLIGHT_RIGHT("slight-right", Maneuver.TYPE_TURN_SLIGHT_RIGHT),
    RIGHT("right", Maneuver.TYPE_TURN_NORMAL_RIGHT),
    SHARP_RIGHT("sharp-right", Maneuver.TYPE_TURN_SHARP_RIGHT),
    UTURN_RIGHT("uturn-right", Maneuver.TYPE_U_TURN_RIGHT),
    KEEP_LEFT("keep-left", Maneuver.TYPE_KEEP_LEFT),
    KEEP_RIGHT("keep-right", Maneuver.TYPE_KEEP_RIGHT),
    RAMP_LEFT("ramp-left", Maneuver.TYPE_ON_RAMP_NORMAL_LEFT),
    RAMP_RIGHT("ramp-right", Maneuver.TYPE_ON_RAMP_NORMAL_RIGHT),
    MERGE("merge", Maneuver.TYPE_MERGE_SIDE_UNSPECIFIED),
    ROUNDABOUT("roundabout", Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW),
    FERRY_ENTER("ferry-enter", Maneuver.TYPE_FERRY_BOAT),
    CONTINUE("continue", Maneuver.TYPE_STRAIGHT);

    companion object {
        private val byWire = values().associateBy { it.wire }

        /** Resolves a wire value, mapping unknown/forward-compatible kinds to [CONTINUE]. */
        fun fromWire(wire: String): RouteManeuverType = byWire[wire] ?: CONTINUE
    }
}

/** Turns a route polyline into an ordered list of [CarManeuver]s (depart … turns … destination). */
object CarManeuverGenerator {
    private const val MIN_TURN_DEG = 30.0
    private const val SLIGHT_MAX_DEG = 45.0
    private const val NORMAL_MAX_DEG = 120.0
    private const val SHARP_MAX_DEG = 160.0
    // Don't emit two maneuvers closer than this — collapses shape-point jitter into one turn.
    private const val MIN_SPACING_M = 25.0

    /**
     * Show locally-synthesized turns right away. These are deliberately never cached, so every
     * launch re-fetches from the backend; the cache is only consulted if that fetch fails.
     */
    fun generate(route: List<LatLng>): List<CarManeuver> {
        if (route.size < 2) return emptyList()
        val points = route.map { Point.fromLngLat(it.longitude, it.latitude) }
        val maneuvers = ArrayList<CarManeuver>()
        maneuvers.add(CarManeuver(Maneuver.TYPE_DEPART, "Head out", 0.0))
        var cumulative = 0.0
        var lastTurnAt = 0.0
        for (i in 1 until points.size - 1) {
            cumulative +=
                    TurfMeasurement.distance(points[i - 1], points[i], TurfConstants.UNIT_METERS)
            val delta =
                    normalize(
                            TurfMeasurement.bearing(points[i], points[i + 1]) -
                                    TurfMeasurement.bearing(points[i - 1], points[i])
                    )
            val magnitude = abs(delta)
            if (magnitude < MIN_TURN_DEG) continue
            if (cumulative - lastTurnAt < MIN_SPACING_M) continue
            val right = delta > 0
            maneuvers.add(
                    CarManeuver(maneuverType(magnitude, right), cue(magnitude, right), cumulative)
            )
            lastTurnAt = cumulative
        }
        cumulative +=
                TurfMeasurement.distance(
                        points[points.size - 2],
                        points[points.size - 1],
                        TurfConstants.UNIT_METERS
                )
        maneuvers.add(CarManeuver(Maneuver.TYPE_DESTINATION, "Arrive at destination", cumulative))
        return maneuvers
    }

    private fun maneuverType(magnitude: Double, right: Boolean): Int =
            when {
                magnitude < SLIGHT_MAX_DEG ->
                        if (right) Maneuver.TYPE_TURN_SLIGHT_RIGHT
                        else Maneuver.TYPE_TURN_SLIGHT_LEFT
                magnitude < NORMAL_MAX_DEG ->
                        if (right) Maneuver.TYPE_TURN_NORMAL_RIGHT
                        else Maneuver.TYPE_TURN_NORMAL_LEFT
                magnitude < SHARP_MAX_DEG ->
                        if (right) Maneuver.TYPE_TURN_SHARP_RIGHT else Maneuver.TYPE_TURN_SHARP_LEFT
                else -> if (right) Maneuver.TYPE_U_TURN_RIGHT else Maneuver.TYPE_U_TURN_LEFT
            }

    private fun cue(magnitude: Double, right: Boolean): String =
            when {
                magnitude < SLIGHT_MAX_DEG -> if (right) "Slight right" else "Slight left"
                magnitude < SHARP_MAX_DEG -> if (right) "Turn right" else "Turn left"
                else -> "Make a U-turn"
            }

    /** Wrap a bearing difference into [-180, 180]; positive is a right turn. */
    private fun normalize(angle: Double): Double = ((angle + 540) % 360) - 180
}
