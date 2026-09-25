import CoreLocation
import Foundation

/// A position in the trail: when it arrived, and the distance in meters counted up to it.
private struct PacePoint {
    let time: TimeInterval
    let distance: Double
}

/// Mirrors `CarPaceCalculator.kt`: how fast the car is going, measured from the positions of the
/// last `paceWindowSeconds` rather than read off `CLLocation.speed`. A remaining time taken off a
/// single reading jumps between fixes and drops to nothing at every red light, while a trail of
/// positions gives one that is steady enough to show and holds still while the car is stopped.
/// Mirrors the way the app measures the pace behind its own ETA, in LocationService.
///
/// One instance follows one stream of locations, so every consumer keeps its own.
final class CarPaceCalculator {

    private var trail: [PacePoint] = []
    private var lastCountedLocation: CLLocation?
    private var countedDistance = 0.0

    /// The speed, in meters per second, measured the last time the car was moving, or nil before it
    /// moved at all. A stop is not allowed to overwrite it, so waiting at a light holds the arrival
    /// time where it is instead of pushing it towards never. Until the trail is long enough to
    /// measure a speed, the one the location reported.
    private(set) var speed: Double?

    /// Adds a position to the trail the `speed` is measured from. A position that did not move counts
    /// towards the time but not the distance, so that a stop is measured as a stop, and a position
    /// that arrived after a gap starts a new trail - where the speed it reports carries the estimate
    /// until that trail has one of its own.
    func updatePace(_ location: CLLocation) {
        let time = location.timestamp.timeIntervalSince1970
        if isAfterGap(time) {
            clear()
        }
        let distance = lastCountedLocation?.distance(from: location) ?? 0
        if lastCountedLocation == nil || distance >= Self.minimalMovementMeters {
            countedDistance += distance
            lastCountedLocation = location
        }
        trail.append(PacePoint(time: time, distance: countedDistance))
        while trail.count > 2 && time - trail[1].time >= Self.paceWindowSeconds {
            trail.removeFirst()
        }
        guard let first = trail.first, let latest = trail.last else { return }
        let duration = latest.time - first.time
        let measured = duration > 0 ? (latest.distance - first.distance) / duration : 0
        if measured > Self.minimalMovingSpeed {
            speed = measured
        } else if speed == nil, location.speed > Self.minimalMovingSpeed {
            // A negative speed is how CoreLocation says it does not have one
            speed = location.speed
        }
    }

    /// Whether the given position arrived too long after the last one for the two to be part of the
    /// same trail - see `maximalGapSeconds`.
    private func isAfterGap(_ time: TimeInterval) -> Bool {
        guard let lastInTrail = trail.last else { return false }
        return time - lastInTrail.time > Self.maximalGapSeconds
    }

    private func clear() {
        trail.removeAll()
        lastCountedLocation = nil
        countedDistance = 0
        speed = nil
    }

    /// The length of the trail of positions the speed is measured over.
    private static let paceWindowSeconds: TimeInterval = 15 * 60

    /// How far a position has to be from the last counted one to count, so GPS wander is not movement.
    private static let minimalMovementMeters = 10.0

    /// Below this speed, in meters per second, the car is stopped rather than moving slowly.
    private static let minimalMovingSpeed = 0.5

    /// A gap in the positions longer than this ends the trail instead of extending it.
    private static let maximalGapSeconds: TimeInterval = 2 * 60
}
