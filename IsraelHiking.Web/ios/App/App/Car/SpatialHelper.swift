import CoreLocation
import Foundation

/// Mirrors `SpatialHelper.kt`, and the web client's SpatialHelper: the spatial calculations the car
/// experience measures routes with, kept off `CLLocation.distance(from:)`, which allocates two
/// objects per call - a route with tens of thousands of points cannot afford that when it is
/// re-measured on every GPS fix.
enum SpatialHelper {

    /// Good enough for the local, flat plane calculations, the earth is not a perfect sphere anyway.
    static let metersPerLatitudeDegree = 111_320.0

    private static let earthRadiusMeters = 6_371_008.8

    /// How many meters a degree of longitude is worth at the given latitude.
    static func metersPerLongitudeDegree(atLatitude latitude: Double) -> Double {
        metersPerLatitudeDegree * cos(latitude * .pi / 180)
    }

    /// The distance in meters between two positions, measured on the sphere. Used for the distances
    /// along a route, which are measured once per route and have to hold over its whole length.
    static func distanceMeters(_ from: CLLocationCoordinate2D, _ to: CLLocationCoordinate2D) -> Double {
        let fromLatitude = from.latitude * .pi / 180
        let toLatitude = to.latitude * .pi / 180
        let latitudeDelta = (to.latitude - from.latitude) * .pi / 180
        let longitudeDelta = (to.longitude - from.longitude) * .pi / 180
        let a = sin(latitudeDelta / 2) * sin(latitudeDelta / 2)
            + cos(fromLatitude) * cos(toLatitude) * sin(longitudeDelta / 2) * sin(longitudeDelta / 2)
        return 2 * earthRadiusMeters * asin(min(a.squareRoot(), 1))
    }

    /// The bearing in degrees within [0, 360) from one position to another.
    static func bearingDegrees(_ from: CLLocationCoordinate2D, _ to: CLLocationCoordinate2D) -> Double {
        let fromLatitude = from.latitude * .pi / 180
        let toLatitude = to.latitude * .pi / 180
        let longitudeDelta = (to.longitude - from.longitude) * .pi / 180
        let y = sin(longitudeDelta) * cos(toLatitude)
        let x = cos(fromLatitude) * sin(toLatitude) - sin(fromLatitude) * cos(toLatitude) * cos(longitudeDelta)
        return (atan2(y, x) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
    }

    /// Smallest absolute difference between two bearings, in degrees within [0, 180].
    static func angleDifference(_ a: Double, _ b: Double) -> Double {
        let difference = abs(a - b).truncatingRemainder(dividingBy: 360)
        return difference > 180 ? 360 - difference : difference
    }

    /// The distance in meters between a point and the closest place on a segment, measured on a
    /// plane laid around the point.
    static func perpendicularDistanceMeters(_ point: CLLocationCoordinate2D,
                                            _ from: CLLocationCoordinate2D,
                                            _ to: CLLocationCoordinate2D) -> Double {
        let metersPerLongitude = metersPerLongitudeDegree(atLatitude: point.latitude)
        let startX = (from.longitude - point.longitude) * metersPerLongitude
        let startY = (from.latitude - point.latitude) * metersPerLatitudeDegree
        let endX = (to.longitude - point.longitude) * metersPerLongitude
        let endY = (to.latitude - point.latitude) * metersPerLatitudeDegree
        let deltaX = endX - startX
        let deltaY = endY - startY
        let lengthSquared = deltaX * deltaX + deltaY * deltaY
        var projectionFactor = 0.0
        if lengthSquared > 0 {
            projectionFactor = min(max(-(startX * deltaX + startY * deltaY) / lengthSquared, 0), 1)
        }
        let x = startX + projectionFactor * deltaX
        let y = startY + projectionFactor * deltaY
        return (x * x + y * y).squareRoot()
    }

    /// Drops the points that fall within `toleranceMeters` of the line their neighbours draw
    /// (Ramer-Douglas-Peucker), keeping the corners. Iterative rather than recursive, since a
    /// recorded route can hold tens of thousands of points.
    static func simplify(_ points: [CLLocationCoordinate2D], toleranceMeters: Double) -> [CLLocationCoordinate2D] {
        guard points.count > 2 else { return points }
        var kept = [Bool](repeating: false, count: points.count)
        kept[0] = true
        kept[points.count - 1] = true
        var ranges = [(first: 0, last: points.count - 1)]
        while let range = ranges.popLast() {
            if range.last <= range.first + 1 {
                continue
            }
            var farthest = -1
            var farthestDistance = toleranceMeters
            for index in (range.first + 1)..<range.last {
                let distance = perpendicularDistanceMeters(
                    points[index], points[range.first], points[range.last])
                if distance > farthestDistance {
                    farthestDistance = distance
                    farthest = index
                }
            }
            if farthest < 0 {
                // Everything between the two ends is close enough to the line between them to go
                continue
            }
            kept[farthest] = true
            ranges.append((first: range.first, last: farthest))
            ranges.append((first: farthest, last: range.last))
        }
        return points.enumerated().filter { kept[$0.offset] }.map { $0.element }
    }
}
