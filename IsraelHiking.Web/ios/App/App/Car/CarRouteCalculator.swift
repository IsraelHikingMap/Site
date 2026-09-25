import CoreLocation
import Foundation

/// Mirrors `CarRouteCalculator.kt`: remaining distance / time along the route the driver is most
/// likely on. `remainingSeconds` is nil before a speed was measured, when the distance is all there
/// is to show.
struct CarStatistics: Equatable {
    let remainingMeters: Double
    let remainingSeconds: Int?
}

/// Route-relative calculations for the car experience, derived from the current GPS location: how
/// far / long is left of the route the driver is on, which drives the CarPlay navigation session.
///
/// A GPS position is matched to the route segment that minimizes perpendicular distance plus, when
/// a heading is known, how much that segment's bearing differs from it. The heading term keeps the
/// match on the correct leg where a route overlaps itself in the opposite direction (e.g. an
/// out-and-back). Mirrors `CarRouteCalculator.kt`, and through it the weighting in
/// route-statistics.service.ts (findDistanceForLatLngInKMInternal / getClosestRouteToGPSInternal).
///
/// This runs over every point of every route on every GPS fix, so the points are measured on a
/// plane laid around the driver instead of on the sphere - see `SpatialService`. The plane is only
/// trusted near its center, which is where a match can happen at all: how far along the route the
/// match falls is read off the route's own distances, measured once when the route arrives.
enum CarRouteCalculator {

    /// Mirrors MINIMAL_DISTANCE / MINIMAL_ANGLE from route-statistics.service.ts: a candidate route
    /// must score below 50 m (or 50 m + 30° when heading is known) to be considered "the route the
    /// driver is on".
    private static let minimalDistanceM = 50.0
    private static let minimalAngleDeg = 30.0

    /// Where a GPS position projects onto a route.
    private struct RouteProjection {
        /// Distance, in meters, from the route start to the projected point.
        let distanceAlongRouteM: Double
        /// Match cost: perpendicular distance plus the heading penalty when supplied.
        let weight: Double
    }

    /// The route picked by `findClosestRoute` and where the GPS projects onto it.
    private struct ClosestRouteHit {
        let route: CarRouteData
        let distanceAlongRouteM: Double
    }

    /// Picks the route the driver is most likely on (perpendicular distance + heading penalty),
    /// then derives remaining distance by subtracting the projection's along-route position from
    /// the route's length. Returns nil when no route scores below the minimalDistanceM /
    /// minimalAngleDeg threshold.
    ///
    /// - Parameter speed: the speed in meters per second the remaining time is derived from,
    ///   measured by `CarPaceCalculator` rather than read off `location`. Nil before the car has
    ///   moved, which leaves the remaining time unknown.
    static func computeStatistics(routes: [CarRouteData],
                                  location: CLLocation,
                                  speed: Double?) -> CarStatistics? {
        guard !routes.isEmpty else { return nil }
        let heading = location.course >= 0 ? location.course : nil
        guard let hit = findClosestRoute(routes, position: location.coordinate, heading: heading)
        else { return nil }
        let remainingM = max(0, hit.route.lengthMeters - hit.distanceAlongRouteM)
        return CarStatistics(
            remainingMeters: remainingM,
            remainingSeconds: speed.map { Int(remainingM / $0) }
        )
    }

    private static func findClosestRoute(_ routes: [CarRouteData],
                                         position: CLLocationCoordinate2D,
                                         heading: Double?) -> ClosestRouteHit? {
        findClosestRouteWeighted(routes, position: position, heading: heading)
            ?? (heading != nil ? findClosestRouteWeighted(routes, position: position, heading: nil) : nil)
    }

    private static func findClosestRouteWeighted(_ routes: [CarRouteData],
                                                 position: CLLocationCoordinate2D,
                                                 heading: Double?) -> ClosestRouteHit? {
        var minimalWeight = minimalDistanceM + (heading != nil ? minimalAngleDeg : 0)
        var hit: ClosestRouteHit?
        for route in routes {
            guard let projection = project(route, target: position, headingDeg: heading) else { continue }
            if projection.weight < minimalWeight {
                minimalWeight = projection.weight
                hit = ClosestRouteHit(route: route, distanceAlongRouteM: projection.distanceAlongRouteM)
            }
        }
        return hit
    }

    /// Projects `target` onto `route`, choosing the segment that minimizes perpendicular distance
    /// plus - when `headingDeg` is given - how much that segment's bearing differs from the heading.
    /// Returns nil for a degenerate route (fewer than two points).
    private static func project(_ route: CarRouteData,
                                target: CLLocationCoordinate2D,
                                headingDeg: Double?) -> RouteProjection? {
        let points = route.coordinates
        guard points.count >= 2 else { return nil }
        let distancesAlongRoute = route.distancesAlongRouteMeters
        let metersPerLongitudeDegree = SpatialService.metersPerLongitudeDegree(atLatitude: target.latitude)
        var startX = (points[0].longitude - target.longitude) * metersPerLongitudeDegree
        var startY = (points[0].latitude - target.latitude) * SpatialService.metersPerLatitudeDegree
        var bestWeight = Double.greatestFiniteMagnitude
        var bestDistanceAlongRoute = 0.0
        for index in 0..<(points.count - 1) {
            let endX = (points[index + 1].longitude - target.longitude) * metersPerLongitudeDegree
            let endY = (points[index + 1].latitude - target.latitude) * SpatialService.metersPerLatitudeDegree
            let deltaX = endX - startX
            let deltaY = endY - startY
            let lengthSquared = deltaX * deltaX + deltaY * deltaY
            var projectionFactor = 0.0
            if lengthSquared > 0 {
                projectionFactor = min(max(-(startX * deltaX + startY * deltaY) / lengthSquared, 0), 1)
            }
            let x = startX + projectionFactor * deltaX
            let y = startY + projectionFactor * deltaY
            var weight = (x * x + y * y).squareRoot()
            if let headingDeg = headingDeg {
                weight += SpatialService.angleDifference(
                    headingDeg, SpatialService.bearingDegrees(points[index], points[index + 1]))
            }
            if weight < bestWeight {
                bestWeight = weight
                // Taken off the route's own distances rather than measured in the plane, which is
                // only trusted around the driver - the far end of a long route is nowhere near it.
                bestDistanceAlongRoute = distancesAlongRoute[index]
                    + projectionFactor * (distancesAlongRoute[index + 1] - distancesAlongRoute[index])
            }
            startX = endX
            startY = endY
        }
        return RouteProjection(distanceAlongRouteM: bestDistanceAlongRoute, weight: bestWeight)
    }
}
