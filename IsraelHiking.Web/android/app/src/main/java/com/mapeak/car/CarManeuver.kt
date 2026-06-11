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
         * Build maneuvers from the GraphHopper `instructions` array returned by the map-match
         * endpoint. Each instruction carries the length of its own segment in `distance`; the
         * maneuver is performed at the start of that segment, so its distance-from-start is the
         * running total of the preceding instructions' lengths. `text` is already localized by the
         * backend (the language is sent with the request), so it is used directly as the cue.
         */
        fun fromInstructions(instructions: JSONArray): List<CarManeuver> {
            val maneuvers = ArrayList<CarManeuver>(instructions.length())
            var cumulative = 0.0
            for (i in 0 until instructions.length()) {
                val instruction = instructions.optJSONObject(i) ?: continue
                val sign = instruction.optInt("sign", SIGN_CONTINUE)
                val text = instruction.optString("text")
                val exitNumber =
                        if (instruction.isNull("exit_number")) null
                        else instruction.optInt("exit_number")
                val turnAngle = instruction.optDouble("turn_angle", Double.NaN)
                maneuvers.add(toManeuver(sign, text, cumulative, exitNumber, turnAngle))
                cumulative += instruction.optDouble("distance", 0.0)
            }
            return maneuvers
        }

        /**
         * Builds a single maneuver from a GraphHopper instruction. A roundabout (sign 6) needs a
         * valid exit number (>= 1) to render, so without one it falls back to a plain straight
         * maneuver rather than crashing the maneuver builder. Its circulation direction comes from
         * GraphHopper's `turnAngle` (radians): positive is clockwise (left-hand traffic), negative
         * is counter-clockwise; NaN/absent falls through to counter-clockwise (right-hand traffic,
         * the global majority).
         */
        private fun toManeuver(
                sign: Int,
                text: String,
                distanceAlongRouteM: Double,
                exitNumber: Int?,
                turnAngle: Double
        ): CarManeuver {
            if (sign == SIGN_ROUNDABOUT && exitNumber != null && exitNumber >= 1) {
                val type =
                        if (turnAngle > 0) Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CW
                        else Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW
                return CarManeuver(type, text, distanceAlongRouteM, exitNumber)
            }
            return CarManeuver(signToManeuverType(sign), text, distanceAlongRouteM)
        }

        /**
         * Maps a GraphHopper instruction sign to the closest Android for Cars maneuver type. Signs
         * without a dedicated turn (continue/unknown) map to a straight maneuver.
         */
        private fun signToManeuverType(sign: Int): Int =
                when (sign) {
                    SIGN_U_TURN_UNKNOWN, SIGN_U_TURN_LEFT -> Maneuver.TYPE_U_TURN_LEFT
                    SIGN_U_TURN_RIGHT -> Maneuver.TYPE_U_TURN_RIGHT
                    SIGN_KEEP_LEFT -> Maneuver.TYPE_KEEP_LEFT
                    SIGN_TURN_SHARP_LEFT -> Maneuver.TYPE_TURN_SHARP_LEFT
                    SIGN_TURN_LEFT -> Maneuver.TYPE_TURN_NORMAL_LEFT
                    SIGN_TURN_SLIGHT_LEFT -> Maneuver.TYPE_TURN_SLIGHT_LEFT
                    SIGN_TURN_SLIGHT_RIGHT -> Maneuver.TYPE_TURN_SLIGHT_RIGHT
                    SIGN_TURN_RIGHT -> Maneuver.TYPE_TURN_NORMAL_RIGHT
                    SIGN_TURN_SHARP_RIGHT -> Maneuver.TYPE_TURN_SHARP_RIGHT
                    SIGN_KEEP_RIGHT -> Maneuver.TYPE_KEEP_RIGHT
                    SIGN_FINISH, SIGN_REACHED_VIA -> Maneuver.TYPE_DESTINATION
                    else -> Maneuver.TYPE_STRAIGHT
                }

        // GraphHopper instruction signs (see com.graphhopper.util.Instruction).
        private const val SIGN_U_TURN_UNKNOWN = -98
        private const val SIGN_U_TURN_LEFT = -8
        private const val SIGN_KEEP_LEFT = -7
        private const val SIGN_TURN_SHARP_LEFT = -3
        private const val SIGN_TURN_LEFT = -2
        private const val SIGN_TURN_SLIGHT_LEFT = -1
        private const val SIGN_CONTINUE = 0
        private const val SIGN_TURN_SLIGHT_RIGHT = 1
        private const val SIGN_TURN_RIGHT = 2
        private const val SIGN_TURN_SHARP_RIGHT = 3
        private const val SIGN_FINISH = 4
        private const val SIGN_REACHED_VIA = 5
        private const val SIGN_ROUNDABOUT = 6
        private const val SIGN_KEEP_RIGHT = 7
        private const val SIGN_U_TURN_RIGHT = 8
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
