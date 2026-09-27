import CarPlay
import CoreLocation
import MapKit
import UIKit

/// CarPlay entry point. Mirrors `CarSession` + `CarMapScreen` on Android: hosts the MapLibre map
/// view controller in the CPWindow, wires up zoom/recenter/pan via a `CPMapTemplate`, drives the
/// GPS feed, and shows the remaining-distance / arrival estimate panel through a navigation session.
final class MapeakCarSceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate, CPMapTemplateDelegate, CapacitorStore.Listener {

    private let store = CapacitorStore.shared
    private let locationProvider = CarLocationProvider()
    private var interfaceController: CPInterfaceController?
    private var mapViewController: CarMapViewController?
    private var mapTemplate: CPMapTemplate?

    private var currentTrip: CPTrip?
    private var navigationSession: CPNavigationSession?
    private var lastStatistics: CarStatistics?
    private let paceCalculator = CarPaceCalculator()
    private let navigation = CarNavigation()
    private var searchController: CarSearchController?
    private var routes: [CarRouteData] = []

    /// Retained map buttons (re-asserted after the panning interface dismisses).
    private lazy var zoomInButton = makeMapButton("plus") { [weak self] in self?.mapViewController?.zoomIn() }
    private lazy var zoomOutButton = makeMapButton("minus") { [weak self] in self?.mapViewController?.zoomOut() }
    private lazy var recenterButton = makeMapButton("location.fill") { [weak self] in self?.mapViewController?.recenter() }
    private var mapButtons: [CPMapButton] { [zoomInButton, zoomOutButton, recenterButton] }

    /// The turn card's background, black behind the white maneuver glyphs.
    private static let guidanceBackgroundColor = UIColor.black

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didConnect interfaceController: CPInterfaceController,
                                  to window: CPWindow) {
        self.interfaceController = interfaceController

        let mapVC = CarMapViewController()
        window.rootViewController = mapVC
        mapViewController = mapVC

        let template = CPMapTemplate()
        template.mapDelegate = self
        // Keep the zoom/recenter map buttons on screen: by default CarPlay hides them whenever the
        // navigation bar auto-hides (hidesButtonsWithNavigationBar defaults to true).
        template.automaticallyHidesNavigationBar = false
        template.hidesButtonsWithNavigationBar = false
        template.trailingNavigationBarButtons = [panButton()]
        template.guidanceBackgroundColor = Self.guidanceBackgroundColor
        template.leadingNavigationBarButtons = [searchButton()]
        interfaceController.setRootTemplate(template, animated: false, completion: nil)
        mapTemplate = template
        template.mapButtons = mapButtons

        routes = CarRouteData.list(from: store.load(CarStoreKeys.route))
        searchController = CarSearchController(interfaceController: interfaceController)
        store.addListener(self)
        navigation.onManeuversChanged = { [weak self] in self?.pushManeuvers() }
        navigation.onDistanceToManeuverChanged = { [weak self] in self?.updateManeuverDistance() }
        navigation.attach()
        locationProvider.start()
        recomputeStatistics()
    }

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didDisconnectInterfaceController interfaceController: CPInterfaceController,
                                  from window: CPWindow) {
        store.removeListener(self)
        navigation.detach()
        navigation.onManeuversChanged = nil
        navigation.onDistanceToManeuverChanged = nil
        locationProvider.stop()
        endNavigationSession()
        searchController = nil
        mapViewController = nil
        mapTemplate = nil
        self.interfaceController = nil
    }

    private func makeMapButton(_ symbolName: String, _ action: @escaping () -> Void) -> CPMapButton {
        let button = CPMapButton { _ in action() }
        button.image = Self.symbol(symbolName)
        return button
    }

    /// Mirrors the search action on Android's action strip: opens the destination search.
    private func searchButton() -> CPBarButton {
        let image = UIImage(systemName: "magnifyingglass") ?? UIImage()
        return CPBarButton(image: image) { [weak self] _ in
            guard let self = self, let searchController = self.searchController else { return }
            self.interfaceController?.pushTemplate(searchController.makeTemplate(),
                                                   animated: true,
                                                   completion: nil)
        }
    }

    /// The pan toggle. Nav-bar buttons draw plain glyphs, so this one uses the vector symbol as it is.
    /// It has to dismiss the panning interface as well as open it, since CarPlay hides the
    /// zoom/recenter buttons while it is up and offers no Done of its own.
    private func panButton() -> CPBarButton {
        let image = UIImage(systemName: "hand.draw") ?? UIImage()
        return CPBarButton(image: image) { [weak self] _ in
            guard let self = self, let template = self.mapTemplate else { return }
            if template.isPanningInterfaceVisible {
                template.dismissPanningInterface(animated: true)
            } else {
                template.showPanningInterface(animated: true)
            }
        }
    }

    /// CPMapButton renders the image as-is (no system background or tint), so a bare template glyph
    /// shows up as an near-invisible blue mark. Bake a dark circular background + white glyph into a
    /// raster image (matching the look of the system panning arrows) and keep it as `.alwaysOriginal`.
    private static func symbol(_ name: String) -> UIImage? {
        let config = UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
        guard let glyph = UIImage(systemName: name, withConfiguration: config) else { return nil }
        let canvas = CGSize(width: 44, height: 44)
        let raster = UIGraphicsImageRenderer(size: canvas).image { ctx in
            UIColor(white: 0.18, alpha: 0.85).setFill()
            ctx.cgContext.fillEllipse(in: CGRect(origin: .zero, size: canvas))
            let rect = CGRect(
                x: (canvas.width - glyph.size.width) / 2,
                y: (canvas.height - glyph.size.height) / 2,
                width: glyph.size.width, height: glyph.size.height)
            glyph.withTintColor(.white, renderingMode: .alwaysOriginal).draw(in: rect)
        }
        return raster.withRenderingMode(.alwaysOriginal)
    }

    func mapTemplate(_ mapTemplate: CPMapTemplate, panWith direction: CPMapTemplate.PanDirection) {
        let step: CGFloat = 80
        var dx: CGFloat = 0, dy: CGFloat = 0
        if direction.contains(.left) { dx = -step }
        if direction.contains(.right) { dx = step }
        if direction.contains(.up) { dy = -step }
        if direction.contains(.down) { dy = step }
        mapViewController?.scrollBy(dx: dx, dy: dy)
    }

    func mapTemplate(_ mapTemplate: CPMapTemplate,
                     didUpdatePanGestureWithTranslation translation: CGPoint,
                     velocity: CGPoint) {
        mapViewController?.scrollBy(dx: translation.x, dy: translation.y)
    }

    /// Restores the zoom/recenter buttons that the panning interface replaced.
    func mapTemplateDidDismissPanningInterface(_ mapTemplate: CPMapTemplate) {
        mapTemplate.mapButtons = mapButtons
    }

    func onCarStoreUpdated(_ key: String) {
        switch key {
        case CarStoreKeys.route:
            routes = CarRouteData.list(from: store.load(CarStoreKeys.route))
            endNavigationSession()
            recomputeStatistics()
        case CarStoreKeys.location:
            if let location: CLLocation = store.getTransient(CarStoreKeys.location) {
                paceCalculator.updatePace(location)
            }
            recomputeStatistics()
        case CarStoreKeys.config:
            recomputeStatistics()
        default:
            break
        }
    }

    /// Keeps the navigation session in step with the route and the position. The session runs for as
    /// long as there is a route to follow, the way Android starts it as soon as one arrives; missing
    /// statistics only mean the position matched no route - a wander off it, or a poor fix - and
    /// leave the trip alone rather than cancelling and restarting it.
    private func recomputeStatistics() {
        guard let mapTemplate = mapTemplate,
              let first = routes.first(where: { $0.coordinates.count >= 2 }) else {
            endNavigationSession()
            lastStatistics = nil
            return
        }
        if navigationSession == nil {
            let trip = makeTrip(start: first.coordinates.first!, end: first.coordinates.last!)
            currentTrip = trip
            navigationSession = mapTemplate.startNavigationSession(for: trip)
            pushManeuvers()
        }

        let location: CLLocation? = store.getTransient(CarStoreKeys.location)
        let stats = location.flatMap {
            CarRouteCalculator.computeStatistics(routes: routes, location: $0, speed: paceCalculator.speed)
        }
        guard stats != lastStatistics else { return }
        lastStatistics = stats
        guard let stats = stats, let trip = currentTrip else { return }
        mapTemplate.update(travelEstimates(stats), for: trip, with: .default)
    }

    /// Hands the session the turns `CarNavigation` computed, so the cluster shows the next one.
    /// Only called when the turns themselves changed: assigning `upcomingManeuvers` is what makes
    /// CarPlay present the turn card, so doing it on every GPS fix animates it in over and over.
    private func pushManeuvers() {
        guard let session = navigationSession else { return }
        session.upcomingManeuvers = navigation.upcomingManeuvers
        updateManeuverDistance()
    }

    /// Reports how far the current turn is now. The maneuver is the one the session already holds, so
    /// the card keeps its place and only the distance on it changes. Only that distance is measured,
    /// never a time, so the estimate carries none.
    private func updateManeuverDistance() {
        guard let session = navigationSession,
              let current = navigation.upcomingManeuvers.first else { return }
        session.updateEstimates(
            CPTravelEstimates(
                distanceRemaining: navigation.measurement(navigation.distanceToCurrentManeuverMeters),
                timeRemaining: -1),
            for: current)
    }

    /// The trip's remaining distance and arrival estimate. A negative time renders as "--", which is
    /// what an unmeasured pace should show.
    private func travelEstimates(_ stats: CarStatistics) -> CPTravelEstimates {
        let units = (store.load(CarStoreKeys.config)?["units"] as? String) ?? "metric"
        let meters = Measurement(value: stats.remainingMeters, unit: UnitLength.meters)
        let distance = units == "imperial" ? meters.converted(to: .miles) : meters.converted(to: .kilometers)
        let timeRemaining = stats.remainingSeconds.map(TimeInterval.init) ?? -1
        return CPTravelEstimates(distanceRemaining: distance, timeRemaining: timeRemaining)
    }

    private func makeTrip(start: CLLocationCoordinate2D, end: CLLocationCoordinate2D) -> CPTrip {
        let origin = MKMapItem(placemark: MKPlacemark(coordinate: start))
        let destination = MKMapItem(placemark: MKPlacemark(coordinate: end))
        destination.name = navigation.tripDestinationName
        return CPTrip(origin: origin, destination: destination, routeChoices: [])
    }

    /// Cancels the running trip. A trip's destination is fixed once it starts, so a route change
    /// ends the session and `recomputeStatistics` opens a new one for the new destination.
    private func endNavigationSession() {
        navigationSession?.cancelTrip()
        navigationSession = nil
        currentTrip = nil
    }
}
