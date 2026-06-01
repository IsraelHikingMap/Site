package com.mapeak.car

import androidx.car.app.navigation.model.Maneuver
import kotlin.math.abs
import org.maplibre.android.geometry.LatLng
import org.maplibre.geojson.Point
import org.maplibre.turf.TurfConstants
import org.maplibre.turf.TurfMeasurement

/**
 * A synthesized turn along the route. Android for Cars requires navigation apps to provide
 * turn-by-turn directions, but the routing backend returns only geometry, so we derive maneuvers
 * from bearing changes along the polyline. [cue] is an English string used as a [CarTranslations]
 * key (falls back to itself when untranslated). [distanceAlongRouteM] is measured from the start.
 */
data class CarManeuver(val type: Int, val cue: String, val distanceAlongRouteM: Double)

/** Turns a route polyline into an ordered list of [CarManeuver]s (depart … turns … destination). */
object CarManeuverGenerator {
    private const val MIN_TURN_DEG = 30.0
    private const val SLIGHT_MAX_DEG = 45.0
    private const val NORMAL_MAX_DEG = 120.0
    private const val SHARP_MAX_DEG = 160.0
    // Don't emit two maneuvers closer than this — collapses shape-point jitter into one turn.
    private const val MIN_SPACING_M = 25.0

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
            maneuvers.add(CarManeuver(maneuverType(magnitude, right), cue(magnitude, right), cumulative))
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
                        if (right) Maneuver.TYPE_TURN_SLIGHT_RIGHT else Maneuver.TYPE_TURN_SLIGHT_LEFT
                magnitude < NORMAL_MAX_DEG ->
                        if (right) Maneuver.TYPE_TURN_NORMAL_RIGHT else Maneuver.TYPE_TURN_NORMAL_LEFT
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
