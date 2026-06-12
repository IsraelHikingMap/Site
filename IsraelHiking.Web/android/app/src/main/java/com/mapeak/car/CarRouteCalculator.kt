package com.mapeak.car

import android.location.Location
import kotlin.math.abs
import org.maplibre.geojson.Point
import org.maplibre.turf.TurfConstants
import org.maplibre.turf.TurfMeasurement
import org.maplibre.turf.TurfMisc

/** Remaining distance/time for the route the driver is currently on. */
data class CarStatistics(val remainingMeters: Double, val remainingSeconds: Long)

/**
 * Route-relative calculations for the car experience, derived from the current GPS location: how far
 * along a route we are ([distanceAlongRoute], drives turn-by-turn in CarNavigation) and how far/long
 * is left ([computeStatistics], drives the cluster statistics in CarMapScreen).
 *
 * Both build on the same projection: a GPS position is matched to the route segment that minimizes
 * perpendicular distance plus, when a heading is known, how much that segment's bearing differs from
 * it. The heading term keeps the match on the correct leg where a route overlaps itself in the
 * opposite direction (e.g. an out-and-back). Mirrors the weighting in route-statistics.service.ts
 * (findDistanceForLatLngInKMInternal / getClosestRouteToGPSInternal).
 */
object CarRouteCalculator {
    /** Below this speed (m/s) the GPS ETA would be meaningless, so we skip stats entirely. */
    private const val MIN_SPEED_MPS_FOR_ETA = 0.5f

    /**
     * Mirrors MINIMAL_DISTANCE / MINIMAL_ANGLE from route-statistics.service.ts: a candidate route
     * must score below 50 m (or 50 m + 30° when heading is known) to be considered "the route the
     * driver is on".
     */
    private const val MINIMAL_DISTANCE_M = 50.0
    private const val MINIMAL_ANGLE_DEG = 30.0

    /**
     * Distance, in meters, from the start of [linePoints] to where [location] projects onto it. The
     * GPS heading is taken into account so a self-overlapping route matches the leg actually being
     * driven rather than whichever overlapping leg is geometrically nearest. Returns 0 for a
     * degenerate line (fewer than two points).
     */
    fun distanceAlongRoute(linePoints: List<Point>, location: Location): Double {
        val target = Point.fromLngLat(location.longitude, location.latitude)
        return project(linePoints, target, headingOf(location))?.distanceAlongLineM ?: 0.0
    }

    /**
     * Picks the route the driver is most likely on (perpendicular distance + heading penalty), then
     * derives remaining distance by subtracting the projection's along-line position from the total
     * line length. Returns null when there is no usable speed, or no route scores below the
     * MINIMAL_DISTANCE / MINIMAL_ANGLE threshold.
     */
    fun computeStatistics(routes: List<CarRouteData>, location: Location): CarStatistics? {
        if (routes.isEmpty() || !location.hasSpeed() || location.speed < MIN_SPEED_MPS_FOR_ETA) {
            return null
        }
        val hit = findClosestRoute(routes, location) ?: return null
        val totalM = TurfMeasurement.length(hit.linePoints, TurfConstants.UNIT_METERS)
        val remainingM = (totalM - hit.distanceAlongLineM).coerceAtLeast(0.0)
        return CarStatistics(
                remainingMeters = remainingM,
                remainingSeconds = (remainingM / location.speed).toLong()
        )
    }

    private fun headingOf(location: Location): Double? =
            if (location.hasBearing()) location.bearing.toDouble() else null

    private fun findClosestRoute(routes: List<CarRouteData>, location: Location): ClosestRouteHit? {
        val gpsPoint = Point.fromLngLat(location.longitude, location.latitude)
        val heading = headingOf(location)
        return findClosestRouteWeighted(routes, gpsPoint, heading)
                ?: heading?.let { findClosestRouteWeighted(routes, gpsPoint, null) }
    }

    private fun findClosestRouteWeighted(
            routes: List<CarRouteData>,
            gpsPoint: Point,
            heading: Double?
    ): ClosestRouteHit? {
        var minimalWeight = MINIMAL_DISTANCE_M
        if (heading != null) {
            minimalWeight += MINIMAL_ANGLE_DEG
        }

        var hit: ClosestRouteHit? = null
        for (route in routes) {
            val lngLats = route.lngLats
            if (lngLats.size < 2) continue
            val linePoints = lngLats.map { Point.fromLngLat(it.longitude, it.latitude) }
            val projection = project(linePoints, gpsPoint, heading) ?: continue
            if (projection.weight < minimalWeight) {
                minimalWeight = projection.weight
                hit = ClosestRouteHit(linePoints, projection.distanceAlongLineM)
            }
        }
        return hit
    }

    /**
     * Projects [target] onto [linePoints], choosing the segment that minimizes perpendicular
     * distance plus — when [headingDeg] is given — how much that segment's bearing differs from the
     * heading. Returns null for a degenerate line (fewer than two points).
     */
    private fun project(
            linePoints: List<Point>,
            target: Point,
            headingDeg: Double?
    ): RouteProjection? {
        if (linePoints.size < 2) return null
        var cumulative = 0.0
        var best: RouteProjection? = null
        for (i in 0 until linePoints.size - 1) {
            val segment = listOf(linePoints[i], linePoints[i + 1])
            val projection = TurfMisc.nearestPointOnLine(target, segment, TurfConstants.UNIT_METERS)
            var weight = projection.getNumberProperty("dist").toDouble()
            if (headingDeg != null) {
                val segBearing = TurfMeasurement.bearing(linePoints[i], linePoints[i + 1])
                weight += angleDifference(headingDeg, segBearing)
            }
            val currentBest = best
            if (currentBest == null || weight < currentBest.weight) {
                val along =
                        cumulative +
                                TurfMeasurement.distance(
                                        linePoints[i],
                                        projection.geometry() as Point,
                                        TurfConstants.UNIT_METERS
                                )
                best = RouteProjection(along, weight)
            }
            cumulative +=
                    TurfMeasurement.distance(
                            linePoints[i],
                            linePoints[i + 1],
                            TurfConstants.UNIT_METERS
                    )
        }
        return best
    }

    /** Smallest absolute difference between two bearings, in degrees within [0, 180]. */
    private fun angleDifference(a: Double, b: Double): Double {
        val diff = abs(a - b) % 360.0
        return if (diff > 180.0) 360.0 - diff else diff
    }

    /** Where a GPS position projects onto a route line. */
    private data class RouteProjection(
            /** Distance, in meters, from the line start to the projected point. */
            val distanceAlongLineM: Double,
            /** Match cost: perpendicular distance plus the heading penalty when supplied. */
            val weight: Double
    )

    /** The route picked by [findClosestRoute] and where the GPS projects onto it. */
    private data class ClosestRouteHit(
            val linePoints: List<Point>,
            /** Distance in meters from the route start to the projected GPS position. */
            val distanceAlongLineM: Double
    )
}
