import CarPlay
import CoreLocation
import Foundation

/// Mirrors `CarNavigation.kt`: owns the turns of the active route and which of them is next, while
/// the scene delegate owns the `CPNavigationSession` they are pushed into. Turns come from the
/// map-match backend and are cached under `CarStoreKeys.routeInstructions` to survive offline, with
/// `CarManeuverGenerator`'s geometry-synthesized ones standing in until they arrive.
final class CarNavigation: CapacitorStore.Listener {

    /// A maneuver is considered passed once the driver is this far beyond it.
    private static let epsilonMeters = 1.0
    private static let defaultRoutingType = "4WD"

    private let store = CapacitorStore.shared
    private let backend = CarBackendService()

    private var route: CarRouteData?
    private var maneuvers: [CarManeuver] = []
    /// Bumped on every route change so a late instructions fetch for an old route can be dropped.
    private var routeEpoch = 0

    /// The maneuvers CarPlay should show, current one first. Empty when there is nothing to follow.
    /// The same objects are kept while the driver is heading for the same turn: handing CarPlay new
    /// ones makes it present the turn card again, animation and all, on every GPS fix.
    private(set) var upcomingManeuvers: [CPManeuver] = []
    /// Which maneuver `upcomingManeuvers` was built for, so a fix that did not pass a turn is known.
    private var currentManeuverIndex: Int?
    /// How far the driver still is from `upcomingManeuvers.first`.
    private(set) var distanceToCurrentManeuverMeters: Double = 0
    /// The name shown as the trip's destination.
    private(set) var destinationName: String?
    /// The length of the route being followed, in meters.
    private(set) var totalLengthMeters: Double = 0

    /// Invoked when the turns themselves changed - a new route, or the driver passed one - so the
    /// delegate hands the session a new set of maneuvers.
    var onManeuversChanged: (() -> Void)?
    /// Invoked when only the distance to the current turn changed, which the delegate reports as an
    /// estimate update so that the turn card keeps its place and only its text moves.
    var onDistanceToManeuverChanged: (() -> Void)?

    func attach() {
        store.addListener(self)
        onRouteChanged()
    }

    func detach() {
        store.removeListener(self)
        maneuvers = []
        upcomingManeuvers = []
        currentManeuverIndex = nil
    }

    func onCarStoreUpdated(_ key: String) {
        switch key {
        case CarStoreKeys.route: onRouteChanged()
        case CarStoreKeys.location: onLocationChanged()
        default: break
        }
    }

    /// Takes up the route the store now holds: its turns, its length and the name of its destination.
    private func onRouteChanged() {
        let routes = CarRouteData.list(from: store.load(CarStoreKeys.route))
        let route = routes.first { $0.coordinates.count >= 2 }
        self.route = route
        destinationName = route?.name
        totalLengthMeters = route?.lengthMeters ?? 0
        routeEpoch += 1

        currentManeuverIndex = nil
        guard let route = route else {
            maneuvers = []
            upcomingManeuvers = []
            onManeuversChanged?()
            return
        }
        maneuvers = alignedToRoute(loadCachedManeuvers() ?? CarManeuverGenerator.generate(route.coordinates))
        onLocationChanged()
        fetchInstructions(route.coordinates, epoch: routeEpoch)
    }

    /// Replaces the synthesized turns with the backend's real ones, caching them for offline use.
    /// A failure keeps the ones already in place, and a response for a route that has since changed
    /// (`epoch` no longer current) is dropped. These are new turns, so they replace the card rather
    /// than only moving its distance.
    private func fetchInstructions(_ points: [CLLocationCoordinate2D], epoch: Int) {
        backend.mapMatch(points: points, routingType: Self.defaultRoutingType, language: language()) { [weak self] fetched in
            guard let self = self, epoch == self.routeEpoch, !fetched.isEmpty else { return }
            self.maneuvers = self.alignedToRoute(fetched)
            self.cacheManeuvers(fetched)
            self.currentManeuverIndex = nil
            self.onLocationChanged()
        }
    }

    /// Puts the turns on the route's own scale. The backend measures them along the path it matched
    /// to the road network, which can run a hundred meters shorter than the route's polyline, so
    /// unscaled they all arrive early - the arrival most visibly of all.
    private func alignedToRoute(_ maneuvers: [CarManeuver]) -> [CarManeuver] {
        guard let route = route, let last = maneuvers.last, last.distanceAlongRouteM > 0 else {
            return maneuvers
        }
        let factor = route.lengthMeters / last.distanceAlongRouteM
        guard factor.isFinite, factor > 0 else {
            return maneuvers
        }
        return maneuvers.map {
            CarManeuver(type: $0.type,
                        cue: $0.cue,
                        distanceAlongRouteM: $0.distanceAlongRouteM * factor,
                        roundaboutExitNumber: $0.roundaboutExitNumber)
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

    /// Places the driver on the route and works out which turn is next. While that is the same turn as
    /// before, only its distance is reported, so the turn card is not handed new maneuvers and does
    /// not animate itself back in on every fix.
    private func onLocationChanged() {
        guard let route = route, !maneuvers.isEmpty,
              let location: CLLocation = store.getTransient(CarStoreKeys.location)
        else {
            if !upcomingManeuvers.isEmpty {
                upcomingManeuvers = []
                currentManeuverIndex = nil
                onManeuversChanged?()
            }
            return
        }
        let traveled = CarRouteCalculator.distanceAlongRoute(route, location: location)
        let index = maneuvers.firstIndex { $0.distanceAlongRouteM > traveled + Self.epsilonMeters }
            ?? maneuvers.count - 1
        distanceToCurrentManeuverMeters = max(0, maneuvers[index].distanceAlongRouteM - traveled)

        guard index != currentManeuverIndex else {
            onDistanceToManeuverChanged?()
            return
        }
        currentManeuverIndex = index
        var built = [carManeuver(maneuvers[index], distanceMeters: distanceToCurrentManeuverMeters)]
        if index + 1 < maneuvers.count {
            let next = maneuvers[index + 1]
            built.append(carManeuver(next, distanceMeters: max(0, next.distanceAlongRouteM - traveled)))
        }
        upcomingManeuvers = built
        onManeuversChanged?()
    }

    /// A turn as CarPlay draws it. The estimate carries a distance but no time, since only the
    /// distance to a single turn is measured.
    private func carManeuver(_ maneuver: CarManeuver, distanceMeters: Double) -> CPManeuver {
        let built = CPManeuver()
        built.symbolImage = maneuver.symbolImage
        built.instructionVariants = [instruction(maneuver)]
        built.initialTravelEstimates = CPTravelEstimates(
            distanceRemaining: measurement(distanceMeters),
            timeRemaining: -1)
        return built
    }

    /// The text of a maneuver. Backend and valhalla cues arrive localized, so the lookup falls
    /// through to them; the synthesized ones are English keys. A roundabout's exit number is drawn
    /// into its icon rather than appended here, which would need a translation of its own.
    private func instruction(_ maneuver: CarManeuver) -> String {
        translations().getString(maneuver.cue)
    }

    /// The name for the trip's destination, falling back the way Android's Destination does.
    var tripDestinationName: String {
        destinationName ?? translations().getString("Destination")
    }

    /// The distance to the turn as CarPlay shows it, in the units the app is configured with. Rounded
    /// to a step the driver can read at a glance rather than counting down meter by meter, and below
    /// `hideDistance` reported as unavailable - a negative distance, which CarPlay draws as "--" -
    /// since a countdown that close to the turn only flickers.
    func measurement(_ meters: Double) -> Measurement<UnitLength> {
        if units() == "imperial" {
            let feet = meters / Self.metersPerFoot
            if feet < Self.hideDistanceFeet {
                return Measurement(value: -1, unit: .feet)
            }
            return meters < Self.metersPerMile / 4
                ? Measurement(value: Self.rounded(feet, to: Self.stepFeet), unit: .feet)
                : Measurement(value: meters, unit: UnitLength.meters).converted(to: .miles)
        }
        if meters < Self.hideDistanceMeters {
            return Measurement(value: -1, unit: .meters)
        }
        return meters < Self.metersPerKilometer
            ? Measurement(value: Self.rounded(meters, to: Self.stepMeters), unit: .meters)
            : Measurement(value: meters, unit: UnitLength.meters).converted(to: .kilometers)
    }

    private static func rounded(_ value: Double, to step: Double) -> Double {
        (value / step).rounded() * step
    }

    /// The step the distance to a turn is rounded to, so it does not tick down meter by meter.
    private static let stepMeters = 10.0
    private static let stepFeet = 50.0

    /// Below this the turn is close enough that a distance only flickers, so it is left out.
    private static let hideDistanceMeters = 30.0
    private static let hideDistanceFeet = 100.0

    private static let metersPerFoot = 0.3048
    private static let metersPerMile = 1609.344
    private static let metersPerKilometer = 1000.0

    private func config() -> [String: Any] { store.load(CarStoreKeys.config) ?? [:] }

    private func units() -> String { (config()["units"] as? String) ?? "metric" }

    private func language() -> String { (config()["language"] as? String) ?? "en-US" }

    private func translations() -> Translations { Translations.load(language: language()) }
}
