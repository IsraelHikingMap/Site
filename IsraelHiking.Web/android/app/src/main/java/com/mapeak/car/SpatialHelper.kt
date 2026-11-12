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

    /**
     * The square of a tile as a polygon of lng/lat rings, pulled in from its edges by [inset], a part of the size of
     * the tile, like getTilePolygon of the web client.
     */
    fun getTilePolygon(x: Int, y: Int, zoom: Int, inset: Double = 0.0): List<List<DoubleArray>> {
        val minLng = tileLng(x + inset, zoom)
        val maxLng = tileLng(x + 1 - inset, zoom)
        val maxLat = tileLat(y + inset, zoom)
        val minLat = tileLat(y + 1 - inset, zoom)
        return listOf(listOf(
            doubleArrayOf(minLng, maxLat), doubleArrayOf(maxLng, maxLat), doubleArrayOf(maxLng, minLat),
            doubleArrayOf(minLng, minLat), doubleArrayOf(minLng, maxLat)
        ))
    }

    /** Even-odd ray casting over every ring of a polygon, so a point in a hole is outside */
    fun isPointInPolygon(point: DoubleArray, polygon: List<List<DoubleArray>>): Boolean {
        var inside = false
        for (ring in polygon) {
            var j = ring.size - 1
            for (i in ring.indices) {
                val (xi, yi) = ring[i]
                val (xj, yj) = ring[j]
                if ((yi > point[1]) != (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) {
                    inside = !inside
                }
                j = i
            }
        }
        return inside
    }

    /** Whether two polygons overlap: a point of either is in the other, or one of their edges crosses the other's */
    fun intersects(polygon: List<List<DoubleArray>>, otherPolygon: List<List<DoubleArray>>): Boolean {
        if (polygon.flatten().any { isPointInPolygon(it, otherPolygon) } || otherPolygon.flatten().any { isPointInPolygon(it, polygon) }) {
            return true
        }
        val otherEdges = edges(otherPolygon)
        return edges(polygon).any { (start, end) -> otherEdges.any { (otherStart, otherEnd) -> crosses(start, end, otherStart, otherEnd) } }
    }

    /** How large polygons are by their bounds, in square degrees, which is enough to tell a smaller one from a larger one */
    fun getBoundsArea(polygons: List<List<List<DoubleArray>>>): Double {
        val points = polygons.flatten().flatten()
        return (points.maxOf { it[0] } - points.minOf { it[0] }) * (points.maxOf { it[1] } - points.minOf { it[1] })
    }

    private fun edges(polygon: List<List<DoubleArray>>): List<Pair<DoubleArray, DoubleArray>> =
        polygon.flatMap { ring -> ring.indices.map { ring[it] to ring[(it + 1) % ring.size] } }

    private fun crosses(a: DoubleArray, b: DoubleArray, c: DoubleArray, d: DoubleArray): Boolean =
        side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0

    private fun side(a: DoubleArray, b: DoubleArray, point: DoubleArray): Double =
        Math.signum((b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]))

    private fun tileLng(x: Double, zoom: Int): Double = x / (1 shl zoom) * 360.0 - 180.0

    private fun tileLat(y: Double, zoom: Int): Double =
        Math.toDegrees(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (1 shl zoom)))))
}
