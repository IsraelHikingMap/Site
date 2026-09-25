import CarPlay
import CoreLocation
import Foundation

/**
 * Mirrors `CarSearchScreen.kt`: in-app search for CarPlay. Lets the driver search for a
 * destination, then computes a route from the current location to the selected result and publishes
 * it to the shared store so the map renders it and the navigation session follows it.
 *
 * Android hosts this as its own `Screen` with a `SearchTemplate`; CarPlay pushes a
 * `CPSearchTemplate` onto the interface controller, so the same flow lives in a controller that
 * owns the template rather than in a screen subclass.
 */
final class CarSearchController: NSObject, CPSearchTemplateDelegate {

    private static let routingType = "4WD"
    private static let routeColor = "#1a73e8"
    private static let routeWeight = 8.0
    private static let routeOpacity = 0.8
    private static let defaultZoom = 14.0
    private static let defaultLanguage = "en-US"

    private let store = CapacitorStore.shared
    private let backend = CarBackendService()
    private weak var interfaceController: CPInterfaceController?

    /// The results behind the list items last handed to CarPlay, keyed by the item's identity, so
    /// the selected row can be resolved back to the place it stands for.
    private var resultsByItem: [ObjectIdentifier: CarSearchResult] = [:]

    init(interfaceController: CPInterfaceController?) {
        self.interfaceController = interfaceController
    }

    /// The template to push when the driver asks to search.
    func makeTemplate() -> CPSearchTemplate {
        let template = CPSearchTemplate()
        template.delegate = self
        return template
    }

    // MARK: CPSearchTemplateDelegate

    func searchTemplate(_ searchTemplate: CPSearchTemplate,
                        updatedSearchText searchText: String,
                        completionHandler: @escaping ([CPListItem]) -> Void) {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard term.count > 2 else {
            resultsByItem = [:]
            completionHandler([])
            return
        }
        // Coordinate strings are resolved locally first, the web client does the same before
        // hitting the API
        if let coordinate = Self.parseCoordinates(term) {
            completionHandler(self.items(for: [CarSearchResult(title: term, subtitle: "", location: coordinate)]))
            return
        }
        backend.search(query: term,
                       center: currentLocation(),
                       zoom: currentZoom(),
                       language: simplifiedLanguage()) { [weak self] found in
            guard let self = self else {
                completionHandler([])
                return
            }
            completionHandler(self.items(for: found))
        }
    }

    func searchTemplate(_ searchTemplate: CPSearchTemplate,
                        selectedResult item: CPListItem,
                        completionHandler: @escaping () -> Void) {
        guard let result = resultsByItem[ObjectIdentifier(item)] else {
            completionHandler()
            return
        }
        guard let origin = currentLocation() else {
            // Nothing to route from, so the search stays open rather than clearing itself
            completionHandler()
            return
        }
        backend.route(from: origin, to: result.location, routingType: Self.routingType) { [weak self] points in
            self?.publishRoute(points, title: result.title)
            completionHandler()
            self?.interfaceController?.popToRootTemplate(animated: true, completion: nil)
        }
    }

    func searchTemplateSearchButtonPressed(_ searchTemplate: CPSearchTemplate) {
        // The list already carries every result the search returned, so there is nothing more to
        // show on its own screen.
    }

    // MARK: results

    private func items(for results: [CarSearchResult]) -> [CPListItem] {
        var mapping: [ObjectIdentifier: CarSearchResult] = [:]
        let items = results.map { result -> CPListItem in
            let item = CPListItem(text: result.title,
                                  detailText: result.subtitle.isEmpty ? nil : result.subtitle)
            mapping[ObjectIdentifier(item)] = result
            return item
        }
        resultsByItem = mapping
        return items
    }

    /**
     * Publish the computed route in the same shape the web layer uses (see car.service.ts), so the
     * existing map rendering and travel-estimate logic pick it up unchanged.
     */
    private func publishRoute(_ points: [CLLocationCoordinate2D], title: String) {
        guard !points.isEmpty else { return }
        let route: [String: Any] = [
            "points": points.map { [$0.longitude, $0.latitude] },
            "weight": Self.routeWeight,
            "color": Self.routeColor,
            "opacity": Self.routeOpacity,
            "name": title
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: ["routes": [route]]),
              let json = String(data: data, encoding: .utf8)
        else { return }
        // The turns of the previous route do not describe this one
        store.remove(CarStoreKeys.routeInstructions)
        store.save(CarStoreKeys.route, json)
    }

    /// Parse a "lat,lng" string into a coordinate, or nil when it isn't a valid coordinate pair.
    private static func parseCoordinates(_ term: String) -> CLLocationCoordinate2D? {
        let parts = term.split(separator: ",")
        guard parts.count == 2,
              let lat = Double(parts[0].trimmingCharacters(in: .whitespaces)),
              let lng = Double(parts[1].trimmingCharacters(in: .whitespaces)),
              lat >= -90, lat <= 90, lng >= -180, lng <= 180
        else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    private func currentLocation() -> CLLocationCoordinate2D? {
        if let location: CLLocation = store.getTransient(CarStoreKeys.location) {
            return location.coordinate
        }
        let lat = store.loadDouble(CarStoreKeys.lastLat, default: Double.nan)
        let lng = store.loadDouble(CarStoreKeys.lastLng, default: Double.nan)
        guard !lat.isNaN, !lng.isNaN else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    private func currentZoom() -> Double {
        store.loadDouble(CarStoreKeys.zoom, default: Self.defaultZoom)
    }

    /// Full language code from config, e.g. "en-US" or "he" - matches the translation file names.
    private func language() -> String {
        let configured = (store.load(CarStoreKeys.config)?["language"] as? String) ?? ""
        return configured.isEmpty ? Self.defaultLanguage : configured
    }

    /// Region-stripped code for the search API (e.g. "en"), mirroring the web search provider.
    private func simplifiedLanguage() -> String {
        language().split(separator: "-").first.map(String.init) ?? language()
    }
}
