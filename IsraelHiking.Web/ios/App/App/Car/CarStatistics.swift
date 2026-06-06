import CoreLocation
import Foundation

/// Mirrors `CarStatistics.kt`: remaining distance / time along the route the driver is most likely on.
struct CarStatistics: Equatable {
    let remainingMeters: Double
    let remainingSeconds: Int
}

enum CarStatisticsCalculator {

    /// Below this speed (m/s) the GPS ETA would be meaningless, so we skip stats entirely.
    private static let minSpeedMpsForEta = 0.5
    /// A candidate route must score below 50 m (or 50 m + 30° when heading is known) to count as
    /// "the route the driver is on" (mirrors MINIMAL_DISTANCE / MINIMAL_ANGLE on the web client).
    private static let minimalDistanceM = 50.0
    private static let minimalAngleDeg = 30.0

    private struct ClosestRouteHit {
        let points: [CLLocationCoordinate2D]
        let nearest: CLLocationCoordinate2D
        let segmentIndex: Int
    }

    static func compute(routes: [CarRouteData], location: CLLocation) -> CarStatistics? {
        guard !routes.isEmpty, location.speed >= minSpeedMpsForEta else { return nil }
        guard let hit = findClosestRoute(routes, location: location) else { return nil }
        let total = lineLengthMeters(hit.points)
        let projected = alongLineDistanceMeters(hit)
        let remaining = max(0, total - projected)
        return CarStatistics(
            remainingMeters: remaining,
            remainingSeconds: Int(remaining / location.speed)
        )
    }

    private static func alongLineDistanceMeters(_ hit: ClosestRouteHit) -> Double {
        var along = 0.0
        if hit.segmentIndex > 0 {
            for i in 0..<hit.segmentIndex {
                along += distanceMeters(hit.points[i], hit.points[i + 1])
            }
        }
        along += distanceMeters(hit.points[hit.segmentIndex], hit.nearest)
        return along
    }

    private static func findClosestRoute(_ routes: [CarRouteData], location: CLLocation) -> ClosestRouteHit? {
        let gps = location.coordinate
        let heading = location.course >= 0 ? location.course : nil
        return findClosestRouteWeighted(routes, gps: gps, heading: heading)
            ?? (heading != nil ? findClosestRouteWeighted(routes, gps: gps, heading: nil) : nil)
    }

    private static func findClosestRouteWeighted(_ routes: [CarRouteData],
                                                 gps: CLLocationCoordinate2D,
                                                 heading: Double?) -> ClosestRouteHit? {
        var minimalWeight = minimalDistanceM + (heading != nil ? minimalAngleDeg : 0)
        var hit: ClosestRouteHit?
        for route in routes {
            let points = route.coordinates
            if points.count < 2 { continue }
            let projection = nearestPointOnLine(gps, points)
            var weight = projection.distance
            if let heading = heading {
                let segBearing = bearing(points[projection.index], points[projection.index + 1])
                weight += abs(heading - segBearing)
            }
            if weight < minimalWeight {
                minimalWeight = weight
                hit = ClosestRouteHit(points: points, nearest: projection.point, segmentIndex: projection.index)
            }
        }
        return hit
    }

    // MARK: - geometry (local equirectangular projection; accurate enough for ETA)

    private static func nearestPointOnLine(_ p: CLLocationCoordinate2D,
                                           _ line: [CLLocationCoordinate2D])
        -> (distance: Double, index: Int, point: CLLocationCoordinate2D) {
        var best = (distance: Double.greatestFiniteMagnitude, index: 0, point: line[0])
        let mPerLat = 111_320.0
        let mPerLng = 111_320.0 * cos(p.latitude * .pi / 180)
        func toXY(_ c: CLLocationCoordinate2D) -> (x: Double, y: Double) {
            ((c.longitude - p.longitude) * mPerLng, (c.latitude - p.latitude) * mPerLat)
        }
        for i in 0..<(line.count - 1) {
            let a = toXY(line[i])
            let b = toXY(line[i + 1])
            let abx = b.x - a.x, aby = b.y - a.y
            let lenSq = abx * abx + aby * aby
            var t = 0.0
            if lenSq > 0 { t = max(0, min(1, -(a.x * abx + a.y * aby) / lenSq)) }
            let nx = a.x + t * abx, ny = a.y + t * aby
            let dist = (nx * nx + ny * ny).squareRoot()
            if dist < best.distance {
                let lat = p.latitude + ny / mPerLat
                let lng = p.longitude + (mPerLng != 0 ? nx / mPerLng : 0)
                best = (dist, i, CLLocationCoordinate2D(latitude: lat, longitude: lng))
            }
        }
        return best
    }

    private static func distanceMeters(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }

    private static func lineLengthMeters(_ points: [CLLocationCoordinate2D]) -> Double {
        guard points.count > 1 else { return 0 }
        var total = 0.0
        for i in 0..<(points.count - 1) { total += distanceMeters(points[i], points[i + 1]) }
        return total
    }

    private static func bearing(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let lat1 = a.latitude * .pi / 180, lat2 = b.latitude * .pi / 180
        let dLng = (b.longitude - a.longitude) * .pi / 180
        let y = sin(dLng) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLng)
        return atan2(y, x) * 180 / .pi
    }
}
