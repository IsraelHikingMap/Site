package com.mapeak.car

import android.location.Location
import kotlin.math.sqrt
import org.maplibre.android.geometry.LatLng

/**
 * Remaining distance/time for the route the driver is currently on. [remainingSeconds] is null
 * before a speed was measured, when the distance is all there is to show.
 */
data class CarStatistics(val remainingMeters: Double, val remainingSeconds: Long?)

/**
 * Route-relative calculations for the car experience, derived from the current GPS location: how
 * far along a route we are ([distanceAlongRoute], drives turn-by-turn in CarNavigation) and how
 * far/long is left ([computeStatistics], drives the cluster statistics in CarMapScreen).
 *
 * Both build on the same projection: a GPS position is matched to the route segment that minimizes
 * perpendicular distance plus, when a heading is known, how much that segment's bearing differs
 * from it. The heading term keeps the match on the correct leg where a route overlaps itself in the
 * opposite direction (e.g. an out-and-back). Mirrors the weighting in route-statistics.service.ts
 * (findDistanceForLatLngInKMInternal / getClosestRouteToGPSInternal).
 *
 * This runs over every point of every route on every GPS fix, so the points are measured on a plane
 * laid around the driver instead of on the sphere - see [SpatialHelper]. The plane is only trusted
 * near its center, which is where a match can happen at all: how far along the route the match
 * falls is read off the route's own distances, measured once when the route arrives.
 */
object CarRouteCalculator {
    /**
     * Mirrors MINIMAL_DISTANCE / MINIMAL_ANGLE from route-statistics.service.ts: a candidate route
     * must score below 50 m (or 50 m + 30° when heading is known) to be considered "the route the
     * driver is on".
     */
    private const val MINIMAL_DISTANCE_M = 50.0
    private const val MINIMAL_ANGLE_DEG = 30.0

    /**
     * Distance, in meters, from the start of [route] to where [location] projects onto it. The GPS
     * heading is taken into account so a self-overlapping route matches the leg actually being
     * driven rather than whichever overlapping leg is geometrically nearest. Returns 0 for a
     * degenerate route (fewer than two points).
     */
    fun distanceAlongRoute(route: CarRouteData, location: Location): Double =
            distanceAlongRoute(route, LatLng(location.latitude, location.longitude), headingOf(location))

    /** [distanceAlongRoute] for a position that does not come from the framework. */
    fun distanceAlongRoute(route: CarRouteData, position: LatLng, headingDeg: Double?): Double =
            project(route, position, headingDeg)?.distanceAlongRouteM ?: 0.0

    /**
     * Picks the route the driver is most likely on (perpendicular distance + heading penalty), then
     * derives remaining distance by subtracting the projection's along-route position from the
     * route's length. Returns null when no route scores below the MINIMAL_DISTANCE / MINIMAL_ANGLE
     * threshold.
     *
     * @param speed the speed in meters per second the remaining time is derived from, measured by
     * [CarPaceCalculator] rather than read off [location]. Null before the car has moved, which
     * leaves the remaining time unknown.
     */
    fun computeStatistics(
            routes: List<CarRouteData>,
            location: Location,
            speed: Float?
    ): CarStatistics? =
            computeStatistics(
                    routes,
                    LatLng(location.latitude, location.longitude),
                    headingOf(location),
                    speed
            )

    /** [computeStatistics] for a position that does not come from the framework. */
    fun computeStatistics(
            routes: List<CarRouteData>,
            position: LatLng,
            headingDeg: Double?,
            speed: Float?
    ): CarStatistics? {
        if (routes.isEmpty()) {
            return null
        }
        val hit = findClosestRoute(routes, position, headingDeg) ?: return null
        val remainingM = (hit.route.lengthMeters - hit.distanceAlongRouteM).coerceAtLeast(0.0)
        return CarStatistics(
                remainingMeters = remainingM,
                remainingSeconds = speed?.let { (remainingM / it).toLong() }
        )
    }

    private fun headingOf(location: Location): Double? =
            if (location.hasBearing()) location.bearing.toDouble() else null

    private fun findClosestRoute(
            routes: List<CarRouteData>,
            position: LatLng,
            heading: Double?
    ): ClosestRouteHit? =
            findClosestRouteWeighted(routes, position, heading)
                    ?: heading?.let { findClosestRouteWeighted(routes, position, null) }

    private fun findClosestRouteWeighted(
            routes: List<CarRouteData>,
            gpsPoint: LatLng,
            heading: Double?
    ): ClosestRouteHit? {
        var minimalWeight = MINIMAL_DISTANCE_M
        if (heading != null) {
            minimalWeight += MINIMAL_ANGLE_DEG
        }

        var hit: ClosestRouteHit? = null
        for (route in routes) {
            val projection = project(route, gpsPoint, heading) ?: continue
            if (projection.weight < minimalWeight) {
                minimalWeight = projection.weight
                hit = ClosestRouteHit(route, projection.distanceAlongRouteM)
            }
        }
        return hit
    }

    /**
     * Projects [target] onto [route], choosing the segment that minimizes perpendicular distance
     * plus - when [headingDeg] is given - how much that segment's bearing differs from the heading.
     * Returns null for a degenerate route (fewer than two points).
     */
    private fun project(
            route: CarRouteData,
            target: LatLng,
            headingDeg: Double?
    ): RouteProjection? {
        val points = route.lngLats
        if (points.size < 2) {
            return null
        }
        val distancesAlongRoute = route.distancesAlongRouteMeters
        val metersPerLongitudeDegree = SpatialHelper.metersPerLongitudeDegree(target.latitude)
        var startX = (points[0].longitude - target.longitude) * metersPerLongitudeDegree
        var startY = (points[0].latitude - target.latitude) * SpatialHelper.METERS_PER_LATITUDE_DEGREE
        var bestWeight = Double.MAX_VALUE
        var bestDistanceAlongRoute = 0.0
        for (index in 0 until points.size - 1) {
            val endX = (points[index + 1].longitude - target.longitude) * metersPerLongitudeDegree
            val endY =
                    (points[index + 1].latitude - target.latitude) *
                            SpatialHelper.METERS_PER_LATITUDE_DEGREE
            val deltaX = endX - startX
            val deltaY = endY - startY
            val lengthSquared = deltaX * deltaX + deltaY * deltaY
            val projectionFactor =
                    if (lengthSquared > 0)
                            (-(startX * deltaX + startY * deltaY) / lengthSquared).coerceIn(
                                    0.0,
                                    1.0
                            )
                    else 0.0
            val x = startX + projectionFactor * deltaX
            val y = startY + projectionFactor * deltaY
            var weight = sqrt(x * x + y * y)
            if (headingDeg != null) {
                weight +=
                        SpatialHelper.angleDifference(
                                headingDeg,
                                SpatialHelper.bearingDegrees(points[index], points[index + 1])
                        )
            }
            if (weight < bestWeight) {
                bestWeight = weight
                // Taken off the route's own distances rather than measured in the plane, which is
                // only trusted around the driver - the far end of a long route is nowhere near it.
                bestDistanceAlongRoute =
                        distancesAlongRoute[index] +
                                projectionFactor *
                                        (distancesAlongRoute[index + 1] -
                                                distancesAlongRoute[index])
            }
            startX = endX
            startY = endY
        }
        return RouteProjection(bestDistanceAlongRoute, bestWeight)
    }

    /** Where a GPS position projects onto a route. */
    private data class RouteProjection(
            /** Distance, in meters, from the route start to the projected point. */
            val distanceAlongRouteM: Double,
            /** Match cost: perpendicular distance plus the heading penalty when supplied. */
            val weight: Double
    )

    /** The route picked by [findClosestRoute] and where the GPS projects onto it. */
    private data class ClosestRouteHit(
            val route: CarRouteData,
            /** Distance in meters from the route start to the projected GPS position. */
            val distanceAlongRouteM: Double
    )
}
