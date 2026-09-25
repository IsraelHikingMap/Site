import CarPlay
import CoreLocation
import Foundation

/**
 * Mirrors `CarNavigation.kt`: drives the turn-by-turn side of the CarPlay experience for the active
 * route. It owns the maneuvers and which of them is current; the scene delegate owns the
 * `CPNavigationSession` and pushes what this publishes into it.
 *
 * Whenever the route changes we ask the map-match backend for real turn-by-turn instructions and
 * cache them (keyed to the route) under `CarStoreKeys.routeInstructions` so navigation keeps the
 * directions offline. Until/unless the backend answers we fall back to turns synthesized from the
 * route geometry (see `CarManeuverGenerator`). Everything reacts to the existing store keys
 * (route/location), so the map, statistics and cluster all update with no extra wiring.
 *
 * Android additionally posts a notification and can drive a test-drive simulation; CarPlay has no
 * equivalent of either - the host draws the cluster from the session itself.
 */
final class CarNavigation: CapacitorStore.Listener {

    /// A maneuver is considered passed once the driver is this far beyond it.
    private static let epsilonMeters = 1.0
    private static let defaultRoutingType = "Hike"

    private let store = CapacitorStore.shared
    private let backend = CarBackendService()

    private var route: CarRouteData?
    private var maneuvers: [CarManeuver] = []
    /// Bumped on every route change so a late instructions fetch for an old route can be dropped.
    private var routeEpoch = 0

    /// The maneuvers CarPlay should show, current one first. Empty when there is nothing to follow.
    private(set) var upcomingManeuvers: [CPManeuver] = []
    /// How far the driver still is from `upcomingManeuvers.first`.
    private(set) var distanceToCurrentManeuverMeters: Double = 0
    /// The name shown as the trip's destination.
    private(set) var destinationName: String?
    /// The length of the route being followed, in meters.
    private(set) var totalLengthMeters: Double = 0

    /// Invoked when the maneuvers or the distance to the current one change, so the delegate can
    /// push them into the navigation session.
    var onNavigationChanged: (() -> Void)?

    func attach() {
        store.addListener(self)
        onRouteChanged()
    }

    func detach() {
        store.removeListener(self)
        maneuvers = []
        upcomingManeuvers = []
    }

    func onCarStoreUpdated(_ key: String) {
        switch key {
        case CarStoreKeys.route: onRouteChanged()
        case CarStoreKeys.location: onLocationChanged()
        default: break
        }
    }

    private func onRouteChanged() {
        let routes = CarRouteData.list(from: store.load(CarStoreKeys.route))
        let route = routes.first { $0.coordinates.count >= 2 }
        self.route = route
        destinationName = route?.name
        totalLengthMeters = route?.lengthMeters ?? 0
        routeEpoch += 1

        guard let route = route else {
            maneuvers = []
            upcomingManeuvers = []
            onNavigationChanged?()
            return
        }
        maneuvers = loadCachedManeuvers() ?? CarManeuverGenerator.generate(route.coordinates)
        onLocationChanged()
        fetchInstructions(route.coordinates, epoch: routeEpoch)
    }

    /**
     * Ask the backend to map-match the route to the network and replace `maneuvers` with the real
     * turn-by-turn instructions, caching them so they are available offline. On failure (e.g.
     * offline) the locally-synthesized turns already in place are kept. A response that arrives
     * after the route has changed (`epoch` no longer current) is dropped.
     */
    private func fetchInstructions(_ points: [CLLocationCoordinate2D], epoch: Int) {
        backend.mapMatch(points: points, routingType: Self.defaultRoutingType, language: language()) { [weak self] fetched in
            guard let self = self, epoch == self.routeEpoch, !fetched.isEmpty else { return }
            self.maneuvers = fetched
            self.cacheManeuvers(fetched)
            self.onLocationChanged()
        }
    }

    private func cacheManeuvers(_ maneuvers: [CarManeuver]) {
        let json: [String: Any] = ["maneuvers": maneuvers.map { $0.asJson }]
        guard let data = try? JSONSerialization.data(withJSONObject: json),
              let string = String(data: data, encoding: .utf8)
        else { return }
        store.save(CarStoreKeys.routeInstructions, string)
    }

    private func loadCachedManeuvers() -> [CarManeuver]? {
        guard let json = store.load(CarStoreKeys.routeInstructions),
              let array = json["maneuvers"] as? [[String: Any]],
              !array.isEmpty
        else { return nil }
        let maneuvers = array.compactMap { CarManeuver.from($0) }
        return maneuvers.isEmpty ? nil : maneuvers
    }

    private func onLocationChanged() {
        guard let route = route, !maneuvers.isEmpty,
              let location: CLLocation = store.getTransient(CarStoreKeys.location)
        else {
            if !upcomingManeuvers.isEmpty {
                upcomingManeuvers = []
                onNavigationChanged?()
            }
            return
        }
        let traveled = CarRouteCalculator.distanceAlongRoute(route, location: location)
        let currentIndex = maneuvers.firstIndex { $0.distanceAlongRouteM > traveled + Self.epsilonMeters }
        let current = currentIndex.map { maneuvers[$0] } ?? maneuvers[maneuvers.count - 1]
        let next = currentIndex.flatMap { index -> CarManeuver? in
            index + 1 < maneuvers.count ? maneuvers[index + 1] : nil
        }

        distanceToCurrentManeuverMeters = max(0, current.distanceAlongRouteM - traveled)
        var built = [carManeuver(current, distanceMeters: distanceToCurrentManeuverMeters)]
        if let next = next {
            built.append(carManeuver(next, distanceMeters: max(0, next.distanceAlongRouteM - traveled)))
        }
        upcomingManeuvers = built
        onNavigationChanged?()
    }

    private func carManeuver(_ maneuver: CarManeuver, distanceMeters: Double) -> CPManeuver {
        let built = CPManeuver()
        built.symbolImage = maneuver.type.symbolImage
        built.instructionVariants = [instruction(maneuver)]
        built.initialTravelEstimates = CPTravelEstimates(
            distanceRemaining: measurement(distanceMeters),
            // The time to a single turn is not measured, only the distance to it
            timeRemaining: -1)
        return built
    }

    /**
     * The text of a maneuver. Backend and valhalla instructions arrive already localized, so a
     * translation lookup falls through to the text itself; the synthesized cues are English keys.
     * A roundabout says which exit to take, which CarPlay has no field of its own for.
     */
    private func instruction(_ maneuver: CarManeuver) -> String {
        let cue = translations().getString(maneuver.cue)
        guard maneuver.type == .roundabout, let exit = maneuver.roundaboutExitNumber else {
            return cue
        }
        return "\(cue) (\(translations().getString("Exit")) \(exit))"
    }

    /// The distance as CarPlay shows it, in the units the app is configured with.
    func measurement(_ meters: Double) -> Measurement<UnitLength> {
        let measurement = Measurement(value: meters, unit: UnitLength.meters)
        if units() == "imperial" {
            return meters < 402 ? measurement.converted(to: .feet) : measurement.converted(to: .miles)
        }
        return meters < 1000 ? measurement : measurement.converted(to: .kilometers)
    }

    private func config() -> [String: Any] { store.load(CarStoreKeys.config) ?? [:] }

    private func units() -> String { (config()["units"] as? String) ?? "metric" }

    private func language() -> String { (config()["language"] as? String) ?? "en-US" }

    private func translations() -> Translations { Translations.load(language: language()) }
}
