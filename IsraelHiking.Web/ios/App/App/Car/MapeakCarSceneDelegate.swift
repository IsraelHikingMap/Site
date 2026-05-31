import CarPlay
import CoreLocation
import MapKit
import UIKit

/**
 * CarPlay entry point. Mirrors `CarSession` + `CarMapScreen` on Android: hosts the MapLibre map
 * view controller in the CPWindow, wires up zoom/recenter/pan via a `CPMapTemplate`, drives the
 * GPS feed, and shows the remaining-distance / arrival estimate panel through a navigation session.
 */
final class MapeakCarSceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate, CPMapTemplateDelegate, CarStore.Listener {

    private let store = CarStore.shared
    private let locationProvider = CarLocationProvider()
    private var interfaceController: CPInterfaceController?
    private var mapViewController: CarMapViewController?
    private var mapTemplate: CPMapTemplate?

    private var currentTrip: CPTrip?
    private var navigationSession: CPNavigationSession?
    private var lastStatistics: CarStatistics?
    private var routes: [CarRouteData] = []

    // Retained map buttons (re-asserted after the panning interface dismisses).
    private lazy var zoomInButton = makeMapButton("plus") { [weak self] in self?.mapViewController?.zoomIn() }
    private lazy var zoomOutButton = makeMapButton("minus") { [weak self] in self?.mapViewController?.zoomOut() }
    private lazy var recenterButton = makeMapButton("location.fill") { [weak self] in self?.mapViewController?.recenter() }
    private var mapButtons: [CPMapButton] { [zoomInButton, zoomOutButton, recenterButton] }

    // MARK: connect / disconnect

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
        interfaceController.setRootTemplate(template, animated: false, completion: nil)
        mapTemplate = template
        template.mapButtons = mapButtons

        routes = CarRouteData.list(from: store.loadRoutes())
        store.addListener(self)
        locationProvider.start()
        store.setConnected(true)
        recomputeStatistics()
    }

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didDisconnectInterfaceController interfaceController: CPInterfaceController,
                                  from window: CPWindow) {
        store.removeListener(self)
        locationProvider.stop()
        store.setConnected(false)
        endNavigationSession()
        mapViewController = nil
        mapTemplate = nil
        self.interfaceController = nil
    }

    // MARK: map buttons

    private func makeMapButton(_ symbolName: String, _ action: @escaping () -> Void) -> CPMapButton {
        let button = CPMapButton { _ in action() }
        button.image = Self.symbol(symbolName)
        return button
    }

    private func panButton() -> CPBarButton {
        // Nav-bar buttons render plain glyphs (no baked background needed), so use the vector symbol.
        let image = UIImage(systemName: "hand.draw") ?? UIImage()
        return CPBarButton(image: image) { [weak self] _ in
            guard let self = self, let template = self.mapTemplate else { return }
            // Toggle: CarPlay hides the zoom/recenter map buttons while the panning interface is up,
            // so the button must also dismiss it (there is no separate Done affordance).
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

    // MARK: CPMapTemplateDelegate (panning)

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

    func mapTemplateDidDismissPanningInterface(_ mapTemplate: CPMapTemplate) {
        // Restore the zoom/recenter buttons that the panning interface replaced.
        mapTemplate.mapButtons = mapButtons
    }

    // MARK: CarStore.Listener

    func onCarStoreUpdated(_ key: String) {
        switch key {
        case CarStore.keyRoute:
            routes = CarRouteData.list(from: store.loadRoutes())
            recomputeStatistics()
        case CarStore.keyLocation, CarStore.keyConfig:
            recomputeStatistics()
        default:
            break
        }
    }

    // MARK: ETA

    private func recomputeStatistics() {
        let stats = store.getLocation().flatMap { CarStatisticsCalculator.compute(routes: routes, location: $0) }
        guard stats != lastStatistics else { return }
        lastStatistics = stats

        guard let stats = stats, let mapTemplate = mapTemplate,
              let first = routes.first(where: { $0.coordinates.count >= 2 }) else {
            endNavigationSession()
            return
        }

        if navigationSession == nil {
            let trip = makeTrip(start: first.coordinates.first!, end: first.coordinates.last!)
            currentTrip = trip
            navigationSession = mapTemplate.startNavigationSession(for: trip)
        }
        guard let trip = currentTrip else { return }
        mapTemplate.update(travelEstimates(stats), for: trip, with: .default)
    }

    private func travelEstimates(_ stats: CarStatistics) -> CPTravelEstimates {
        let units = (store.loadConfig()?["units"] as? String) ?? "metric"
        let meters = Measurement(value: stats.remainingMeters, unit: UnitLength.meters)
        let distance = units == "imperial" ? meters.converted(to: .miles) : meters.converted(to: .kilometers)
        return CPTravelEstimates(distanceRemaining: distance, timeRemaining: TimeInterval(stats.remainingSeconds))
    }

    private func makeTrip(start: CLLocationCoordinate2D, end: CLLocationCoordinate2D) -> CPTrip {
        let origin = MKMapItem(placemark: MKPlacemark(coordinate: start))
        let destination = MKMapItem(placemark: MKPlacemark(coordinate: end))
        return CPTrip(origin: origin, destination: destination, routeChoices: [])
    }

    private func endNavigationSession() {
        navigationSession?.cancelTrip()
        navigationSession = nil
        currentTrip = nil
    }
}
