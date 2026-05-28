package com.mapeak.car

import android.location.Location
import org.maplibre.geojson.Feature
import org.maplibre.geojson.Point
import org.maplibre.turf.TurfConstants
import org.maplibre.turf.TurfMeasurement
import org.maplibre.turf.TurfMisc
import kotlin.math.abs

data class CarStatistics(
    val remainingMeters: Double,
    val remainingSeconds: Long
)

object CarStatisticsCalculator {
    /** Below this speed (m/s) the GPS ETA would be meaningless, so we skip stats entirely. */
    private const val MIN_SPEED_MPS_FOR_ETA = 1.5f

    /**
     * Mirrors MINIMAL_DISTANCE / MINIMAL_ANGLE from route-statistics.service.ts:
     * a candidate route must score below 50 m (or 50 m + 30° when heading is known)
     * to be considered "the route the driver is on".
     */
    private const val MINIMAL_DISTANCE_M = 50.0
    private const val MINIMAL_ANGLE_DEG = 30.0

    /** Snapshot of the route picked by [findClosestRoute] and where the GPS projects onto it. */
    private data class ClosestRouteHit(
        val route: CarRouteData,
        val linePoints: List<Point>,
        /** nearestPointOnLine result: properties `dist`, `index`, `location` — all in meters. */
        val projection: Feature
    )

    /**
     * Picks the route the driver is most likely on (perpendicular distance +
     * heading penalty, same weighting as getClosestRouteToGPSInternal in the
     * web client), then derives remaining distance by subtracting the
     * projection's along-line position from the total line length.
     *
     * Returns null when there is no usable speed, or no route scores below the
     * MINIMAL_DISTANCE / MINIMAL_ANGLE threshold.
     */
    fun compute(routes: List<CarRouteData>, location: Location): CarStatistics? {
        if (routes.isEmpty() || !location.hasSpeed() || location.speed < MIN_SPEED_MPS_FOR_ETA) {
            return null
        }
        val hit = findClosestRoute(routes, location) ?: return null
        val totalM = TurfMeasurement.length(hit.linePoints, TurfConstants.UNIT_METERS)
        val projectedM = hit.projection.getNumberProperty("location").toDouble()
        val remainingM = (totalM - projectedM).coerceAtLeast(0.0)
        return CarStatistics(
            remainingMeters = remainingM,
            remainingSeconds = (remainingM / location.speed).toLong()
        )
    }

    private fun findClosestRoute(routes: List<CarRouteData>, location: Location): ClosestRouteHit? {
        val gpsPoint = Point.fromLngLat(location.longitude, location.latitude)
        val heading = if (location.hasBearing()) location.bearing.toDouble() else null
        var minimalWeight = MINIMAL_DISTANCE_M
        if (heading != null) {
            minimalWeight += MINIMAL_ANGLE_DEG
        }

        var hit: ClosestRouteHit? = null
        for (route in routes) {
            val lngLats = route.lngLats
            if (lngLats.size < 2) continue
            val linePoints = lngLats.map { Point.fromLngLat(it.longitude, it.latitude) }
            val projection = TurfMisc.nearestPointOnLine(
                gpsPoint, linePoints, TurfConstants.UNIT_METERS
            )
            var weight = projection.getNumberProperty("dist").toDouble()
            if (heading != null) {
                val segIdx = projection.getNumberProperty("index").toInt()
                val segBearing = TurfMeasurement.bearing(linePoints[segIdx], linePoints[segIdx + 1])
                weight += abs(heading - segBearing)
            }
            if (weight < minimalWeight) {
                minimalWeight = weight
                hit = ClosestRouteHit(route, linePoints, projection)
            }
        }
        return hit
    }
}
