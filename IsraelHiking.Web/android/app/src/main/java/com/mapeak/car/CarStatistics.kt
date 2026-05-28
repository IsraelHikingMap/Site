package com.mapeak.car

import android.location.Location

data class CarStatistics(
    val remainingMeters: Double,
    val remainingSeconds: Long
)

object CarStatisticsCalculator {

    /**
     * For every point in every route, measures distance to the GPS fix. The
     * single closest point picks both the closest route and the index along it
     * to start counting "remaining" from. Remaining distance is then the sum of
     * segment lengths from that index to the end, divided by the GPS speed to
     * yield the ETA.
     *
     * Returns null when there are no routes, no usable speed, or the GPS fix
     * does not project onto any route point.
     */
    fun compute(routes: List<CarRouteData>, location: Location): CarStatistics? {
        if (routes.isEmpty() || !location.hasSpeed() || location.speed <= 0f) {
            return null
        }

        val results = FloatArray(1)
        var closestRoute: CarRouteData? = null
        var closestIndex = 0
        var minDistance = Float.MAX_VALUE

        for (route in routes) {
            for (i in route.lngLats.indices) {
                val point = route.lngLats[i]
                Location.distanceBetween(
                    location.latitude, location.longitude,
                    point.latitude, point.longitude,
                    results
                )
                if (results[0] < minDistance) {
                    minDistance = results[0]
                    closestRoute = route
                    closestIndex = i
                }
            }
        }

        val points = closestRoute?.lngLats ?: return null
        if (closestIndex >= points.size - 1) {
            return CarStatistics(remainingMeters = 0.0, remainingSeconds = 0L)
        }

        var remaining = 0.0
        for (i in closestIndex until points.size - 1) {
            Location.distanceBetween(
                points[i].latitude, points[i].longitude,
                points[i + 1].latitude, points[i + 1].longitude,
                results
            )
            remaining += results[0].toDouble()
        }

        return CarStatistics(
            remainingMeters = remaining,
            remainingSeconds = (remaining / location.speed).toLong()
        )
    }
}
