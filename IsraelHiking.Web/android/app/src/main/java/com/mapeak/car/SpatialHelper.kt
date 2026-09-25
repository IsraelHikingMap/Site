package com.mapeak.car

import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import org.maplibre.android.geometry.LatLng

/**
 * The spatial calculations the car experience measures routes with - the counterpart of
 * SpatialHelper on the web client, and of SpatialHelper.swift on iOS. Turf allocates a feature
 * per call, which a route with tens of thousands of points cannot afford when it is re-measured
 * against the GPS position on every fix.
 */
object SpatialHelper {

    /** Good enough for the local, flat plane calculations, the earth is not a perfect sphere anyway. */
    const val METERS_PER_LATITUDE_DEGREE = 111_320.0

    private const val EARTH_RADIUS_METERS = 6_371_008.8
    private const val DEGREES_TO_RADIANS = Math.PI / 180.0

    /** How many meters a degree of longitude is worth at the given latitude. */
    fun metersPerLongitudeDegree(latitude: Double): Double =
            METERS_PER_LATITUDE_DEGREE * cos(latitude * DEGREES_TO_RADIANS)

    /**
     * The distance in meters between two positions, measured on the sphere. Used for the distances
     * along a route, which are measured once per route and have to hold over its whole length.
     */
    fun distanceMeters(from: LatLng, to: LatLng): Double {
        val fromLatitude = from.latitude * DEGREES_TO_RADIANS
        val toLatitude = to.latitude * DEGREES_TO_RADIANS
        val latitudeDelta = (to.latitude - from.latitude) * DEGREES_TO_RADIANS
        val longitudeDelta = (to.longitude - from.longitude) * DEGREES_TO_RADIANS
        val a =
                sin(latitudeDelta / 2) * sin(latitudeDelta / 2) +
                        cos(fromLatitude) *
                                cos(toLatitude) *
                                sin(longitudeDelta / 2) *
                                sin(longitudeDelta / 2)
        return 2 * EARTH_RADIUS_METERS * asin(sqrt(a).coerceAtMost(1.0))
    }

    /** The bearing in degrees within [0, 360) from one position to another. */
    fun bearingDegrees(from: LatLng, to: LatLng): Double {
        val fromLatitude = from.latitude * DEGREES_TO_RADIANS
        val toLatitude = to.latitude * DEGREES_TO_RADIANS
        val longitudeDelta = (to.longitude - from.longitude) * DEGREES_TO_RADIANS
        val y = sin(longitudeDelta) * cos(toLatitude)
        val x =
                cos(fromLatitude) * sin(toLatitude) -
                        sin(fromLatitude) * cos(toLatitude) * cos(longitudeDelta)
        return (Math.toDegrees(Math.atan2(y, x)) + 360.0) % 360.0
    }

    /** Smallest absolute difference between two bearings, in degrees within [0, 180]. */
    fun angleDifference(a: Double, b: Double): Double {
        val difference = abs(a - b) % 360.0
        return if (difference > 180.0) 360.0 - difference else difference
    }

    /**
     * The distance in meters between a point and the closest place on a segment, measured on a
     * plane laid around the point.
     */
    fun perpendicularDistanceMeters(point: LatLng, from: LatLng, to: LatLng): Double {
        val metersPerLongitudeDegree = metersPerLongitudeDegree(point.latitude)
        val startX = (from.longitude - point.longitude) * metersPerLongitudeDegree
        val startY = (from.latitude - point.latitude) * METERS_PER_LATITUDE_DEGREE
        val endX = (to.longitude - point.longitude) * metersPerLongitudeDegree
        val endY = (to.latitude - point.latitude) * METERS_PER_LATITUDE_DEGREE
        val deltaX = endX - startX
        val deltaY = endY - startY
        val lengthSquared = deltaX * deltaX + deltaY * deltaY
        val projectionFactor =
                if (lengthSquared > 0)
                        (-(startX * deltaX + startY * deltaY) / lengthSquared).coerceIn(0.0, 1.0)
                else 0.0
        val x = startX + projectionFactor * deltaX
        val y = startY + projectionFactor * deltaY
        return sqrt(x * x + y * y)
    }

    /**
     * Drops the points that fall within [toleranceMeters] of the line their neighbours draw
     * (Ramer-Douglas-Peucker), keeping the corners. Iterative rather than recursive, since a
     * recorded route can hold tens of thousands of points.
     */
    fun simplify(points: List<LatLng>, toleranceMeters: Double): List<LatLng> {
        if (points.size <= 2) {
            return points
        }
        val kept = BooleanArray(points.size)
        kept[0] = true
        kept[points.size - 1] = true
        val ranges = ArrayDeque<Pair<Int, Int>>()
        ranges.addLast(0 to points.size - 1)
        while (ranges.isNotEmpty()) {
            val (first, last) = ranges.removeLast()
            if (last <= first + 1) {
                continue
            }
            var farthest = -1
            var farthestDistance = toleranceMeters
            for (index in first + 1 until last) {
                val distance =
                        perpendicularDistanceMeters(points[index], points[first], points[last])
                if (distance > farthestDistance) {
                    farthestDistance = distance
                    farthest = index
                }
            }
            if (farthest < 0) {
                // Everything between the two ends is close enough to the line between them to go
                continue
            }
            kept[farthest] = true
            ranges.addLast(first to farthest)
            ranges.addLast(farthest to last)
        }
        return points.filterIndexed { index, _ -> kept[index] }
    }
}
