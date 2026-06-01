package com.mapeak.car

import org.maplibre.geojson.Feature
import org.maplibre.geojson.Point
import org.maplibre.turf.TurfConstants
import org.maplibre.turf.TurfMeasurement
import org.maplibre.turf.TurfMisc

/** Shared route-geometry helpers used by both the statistics and navigation calculations. */
object CarRouteGeometry {

    /** Distance, in meters, from the line start to where [target] projects onto [linePoints]. */
    fun distanceAlongLine(linePoints: List<Point>, target: Point): Double =
            distanceAlongLine(
                    linePoints,
                    TurfMisc.nearestPointOnLine(target, linePoints, TurfConstants.UNIT_METERS)
            )

    /**
     * Same as above, but reuses an already-computed [nearestPointOnLine][TurfMisc.nearestPointOnLine]
     * result. Computed manually because maplibre-turf only sets `dist`/`index` on the projection —
     * unlike Turf.js it does not populate the along-line `location` property.
     */
    fun distanceAlongLine(linePoints: List<Point>, projection: Feature): Double {
        val index = projection.getNumberProperty("index").toInt()
        val nearest = projection.geometry() as Point
        var along = 0.0
        for (i in 0 until index) {
            along +=
                    TurfMeasurement.distance(
                            linePoints[i],
                            linePoints[i + 1],
                            TurfConstants.UNIT_METERS
                    )
        }
        along += TurfMeasurement.distance(linePoints[index], nearest, TurfConstants.UNIT_METERS)
        return along
    }
}
