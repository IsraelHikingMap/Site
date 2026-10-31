import CoreLocation
import Foundation

/// Mirrors `CarPaceCalculator.kt`: how fast the car is going, the average of the last `maximalSpeeds`
/// speeds the location reported while moving. A single reading jumps between fixes, and readings
/// taken while stopped are left out so that a stop holds the arrival time instead of pushing it
/// towards never. Mirrors the way the app measures the pace behind its own ETA, in PaceCalculatorService.
///
/// One instance follows one stream of locations, so every consumer keeps its own.
final class CarPaceCalculator {

    private var speeds: [Double] = []

    /// The speed, in meters per second, or nil before the car moved at all.
    private(set) var speed: Double?

    /// A negative `CLLocation.speed`, which is how CoreLocation says it has none, falls below
    /// `minimalMovingSpeed` and is left out with the readings taken while stopped.
    func updatePace(_ location: CLLocation) {
        guard location.speed > Self.minimalMovingSpeed else { return }
        speeds.append(location.speed)
        if speeds.count > Self.maximalSpeeds {
            speeds.removeFirst()
        }
        speed = speeds.reduce(0, +) / Double(speeds.count)
    }

    /// How many of the latest speeds are averaged.
    private static let maximalSpeeds = 10

    /// Below this speed, in meters per second, the car is stopped rather than moving slowly.
    private static let minimalMovingSpeed = 0.5
}
