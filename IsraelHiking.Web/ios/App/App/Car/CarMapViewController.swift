import CoreLocation
import MapLibre
import UIKit

/**
 * Hosts the MapLibre map shown on the CarPlay screen. Ports `CarMapContainer.kt`: loads the style
 * pushed from JS, renders the planned route (line + directional arrows + start/end points) and the
 * GPS location (heading arrow + accuracy circle), keeps the dot in the bottom third, auto-recenters
 * after a pan, and exposes pan/zoom/recenter for the CarPlay map buttons.
 *
 * Layer ordering uses the hidden `car-layering-anchor` layer that `addLayeringAnchor` injects into
 * the style: route layers go below it, location layers above it.
 */
final class CarMapViewController: UIViewController, MLNMapViewDelegate, CapacitorStore.Listener {

    // Injected into every style by addLayeringAnchor so that route layers can be added below the
    // anchor and location layers above it. Mirrors the constants in CarMapContainer.kt.
    static let layeringAnchorId = "car-layering-anchor"
    static let layeringAnchorSourceId = "car-layering-anchor-source"

    private let store = CapacitorStore.shared
    private var mapView: MLNMapView!

    private var routes: [CarRouteData] = []
    private var lastUserInteraction = Date.distantPast
    private var lastSavedZoom = Double.nan
    private var didApplyInitialCamera = false

    // Manual camera animation: MapLibre's own animated transitions don't tick on the CarPlay
    // external display, so we interpolate center + heading frame-by-frame off the CarPlay screen.
    private var displayLink: CADisplayLink?
    private var animStart: CFTimeInterval = 0
    private var animFromCenter = CLLocationCoordinate2D()
    private var animToCenter = CLLocationCoordinate2D()
    private var animFromHeading: CLLocationDirection = 0
    private var animToHeading: CLLocationDirection = 0

    // Sources kept around so updates re-use them instead of rebuilding the style.
    private var routeLineSource: MLNShapeSource?
    private var routePointSource: MLNShapeSource?
    private var locationPointSource: MLNShapeSource?
    private var locationCircleSource: MLNShapeSource?

    // MARK: lifecycle

    override func loadView() {
        CarMapViewController.configureTileLoading()
        let mapView = MLNMapView(frame: .zero)
        mapView.delegate = self
        mapView.logoView.isHidden = true
        mapView.attributionButton.isHidden = true
        mapView.compassView.isHidden = true
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        self.mapView = mapView
        self.view = mapView

        let attribution = UILabel()
        attribution.text = "© OpenStreetMap"
        attribution.font = .systemFont(ofSize: 10)
        attribution.textColor = UIColor(white: 0.45, alpha: 0.7)
        attribution.translatesAutoresizingMaskIntoConstraints = false
        mapView.addSubview(attribution)
        NSLayoutConstraint.activate([
            attribution.trailingAnchor.constraint(equalTo: mapView.trailingAnchor, constant: -4),
            attribution.bottomAnchor.constraint(equalTo: mapView.bottomAnchor, constant: -2)
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        routes = CarRouteData.list(from: store.load(CarStoreKeys.route))
        applyStyle(store.loadString(CarStoreKeys.style))
        store.addListener(self)
    }

    deinit {
        stopCameraAnimation()
        store.removeListener(self)
    }

    // MARK: tile loading

    private static var tileLoadingConfigured = false
    static func configureTileLoading() {
        if tileLoadingConfigured { return }
        tileLoadingConfigured = true
        let config = URLSessionConfiguration.default
        var protocols: [AnyClass] = [SliceURLProtocol.self]
        protocols.append(contentsOf: config.protocolClasses ?? [])
        config.protocolClasses = protocols
        MLNNetworkConfiguration.sharedManager.sessionConfiguration = config
    }

    // MARK: CapacitorStore.Listener

    func onCarStoreUpdated(_ key: String) {
        switch key {
        case CarStoreKeys.style:
            applyStyle(store.loadString(CarStoreKeys.style))
        case CarStoreKeys.route:
            routes = CarRouteData.list(from: store.load(CarStoreKeys.route))
            if let style = mapView.style { renderRoutes(style) }
        case CarStoreKeys.location:
            handleLocationUpdate()
        default:
            break
        }
    }

    private func currentLocation() -> CLLocation? { store.getTransient(CarStoreKeys.location) }

    // MARK: MLNMapViewDelegate

    func mapView(_ mapView: MLNMapView, didFinishLoading style: MLNStyle) {
        // The PNGs are large (gps-arrow is 84x111px); load them at a higher scale so MapLibre draws
        // them at a sane point size instead of filling the screen.
        loadStyleImage(style, resource: "gps-arrow", name: Const.locationIconImage, sdf: false, scale: 3.0)
        // Arrow must be a template (SDF) image so the per-feature iconColor expression recolors it.
        loadStyleImage(style, resource: "arrow", name: Const.routeArrowIconImage, sdf: true, scale: 2.0)
        applyInitialCameraIfNeeded()
        renderRoutes(style)
        renderGpsLocation(style)
    }

    private func applyInitialCameraIfNeeded() {
        if didApplyInitialCamera { return }
        didApplyInitialCamera = true
        let coordinate = currentLocation()?.coordinate ?? loadLastKnownLocation()
        var zoom = store.loadDouble(CarStoreKeys.zoom, default: Const.defaultZoom)
        // Guard against a stale world-level zoom (nobody drives at < z4); recover to the default.
        if zoom < 4 { zoom = 14 }
        mapView.setCenter(coordinate, zoomLevel: zoom, direction: 0, animated: false)
    }

    // MARK: location

    private func handleLocationUpdate() {
        if let style = mapView.style { renderGpsLocation(style) }
        guard let location = currentLocation() else { return }
        if Date().timeIntervalSince(lastUserInteraction) >= Const.panSuppression {
            centerOn(location)
        }
    }

    private func centerOn(_ location: CLLocation) {
        center(on: location.coordinate, course: location.course)
    }

    private func center(on coordinate: CLLocationCoordinate2D, course: CLLocationDirection) {
        // Shift the camera target so the location lands in the bottom third (what's ahead stays in
        // view), mirroring CarMapContainer.setCenter on Android: project the point against the current
        // camera, offset it down by a sixth of the height in screen space, then unproject. A good
        // approximation even though the bearing changes during the animation.
        let bounds = mapView.bounds
        let anchorX = bounds.midX
        let anchorY = bounds.midY + bounds.height / 6
        let current = mapView.convert(coordinate, toPointTo: mapView)
        let targetPoint = CGPoint(x: current.x - (anchorX - bounds.midX),
                                  y: current.y - (anchorY - bounds.midY))
        let target = mapView.convert(targetPoint, toCoordinateFrom: mapView)

        // Retarget the manual animation from the current camera to the new pose. If an animation is
        // already running it continues smoothly from where it is; otherwise we start the display link.
        animFromCenter = mapView.centerCoordinate
        animToCenter = target
        animFromHeading = mapView.direction
        animToHeading = course >= 0 ? course : mapView.direction
        animStart = CACurrentMediaTime()
        startCameraAnimation()
    }

    private func startCameraAnimation() {
        if displayLink != nil { return }
        // Bind the link to the CarPlay screen so it actually ticks (the main-screen link does not
        // drive the external display).
        let screen = view.window?.screen ?? mapView.window?.screen ?? UIScreen.main
        guard let link = screen.displayLink(withTarget: self, selector: #selector(stepCameraAnimation)) else { return }
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    private func stopCameraAnimation() {
        displayLink?.invalidate()
        displayLink = nil
    }

    @objc private func stepCameraAnimation() {
        let t = min(1, (CACurrentMediaTime() - animStart) / Const.cameraEase)
        let e = 1 - pow(1 - t, 3) // ease-out cubic
        let lat = animFromCenter.latitude + (animToCenter.latitude - animFromCenter.latitude) * e
        let lng = animFromCenter.longitude + (animToCenter.longitude - animFromCenter.longitude) * e
        let heading = animFromHeading + shortestHeadingDelta(animFromHeading, animToHeading) * e
        mapView.setCenter(CLLocationCoordinate2D(latitude: lat, longitude: lng),
                          zoomLevel: mapView.zoomLevel, animated: false)
        // setCenter's direction parameter doesn't rotate the map on the CarPlay display; set the
        // bearing explicitly so the map turns to face the direction of travel (heading-up).
        mapView.setDirection(heading, animated: false)
        if t >= 1 { stopCameraAnimation() }
    }

    private func shortestHeadingDelta(_ from: CLLocationDirection, _ to: CLLocationDirection) -> Double {
        var delta = (to - from).truncatingRemainder(dividingBy: 360)
        if delta > 180 { delta -= 360 }
        if delta < -180 { delta += 360 }
        return delta
    }

    private func renderGpsLocation(_ style: MLNStyle) {
        guard let location = currentLocation() else {
            locationPointSource?.shape = nil
            locationCircleSource?.shape = nil
            return
        }
        let point = MLNPointFeature()
        point.coordinate = location.coordinate
        if location.course >= 0 { point.attributes = ["heading": location.course] }

        let circle = accuracyCircle(center: location.coordinate,
                                    radiusMeters: max(location.horizontalAccuracy, 1))

        if let pointSource = locationPointSource, let circleSource = locationCircleSource {
            pointSource.shape = point
            circleSource.shape = circle
            return
        }

        let pointSource = MLNShapeSource(identifier: Const.locationPointSource, shape: point, options: nil)
        let circleSource = MLNShapeSource(identifier: Const.locationCircleSource, shape: circle, options: nil)
        style.addSource(pointSource)
        style.addSource(circleSource)
        locationPointSource = pointSource
        locationCircleSource = circleSource
        addLocationLayers(style)
    }

    private func addLocationLayers(_ style: MLNStyle) {
        let fill = MLNFillStyleLayer(identifier: Const.locationCircleLayer, source: locationCircleSource!)
        fill.fillColor = NSExpression(forConstantValue: Const.accuracyColor)
        fill.fillOutlineColor = NSExpression(forConstantValue: Const.accuracyColor)
        fill.fillOpacity = NSExpression(forConstantValue: 0.2)

        let stroke = MLNLineStyleLayer(identifier: Const.locationCircleStrokeLayer, source: locationCircleSource!)
        stroke.lineColor = NSExpression(forConstantValue: Const.accuracyColor)
        stroke.lineWidth = NSExpression(forConstantValue: 2)

        let icon = MLNSymbolStyleLayer(identifier: Const.locationIconLayer, source: locationPointSource!)
        icon.iconImageName = NSExpression(forConstantValue: Const.locationIconImage)
        icon.iconScale = NSExpression(forConstantValue: 1.0)
        icon.iconRotation = NSExpression(forKeyPath: "heading")
        icon.iconRotationAlignment = NSExpression(forConstantValue: "map")
        icon.iconAllowsOverlap = NSExpression(forConstantValue: true)
        icon.iconIgnoresPlacement = NSExpression(forConstantValue: true)

        // Location renders above the layering anchor (and therefore above routes).
        for layer in [fill, stroke, icon] { insertAboveAnchor(layer, in: style) }
    }

    private func accuracyCircle(center: CLLocationCoordinate2D, radiusMeters: Double) -> MLNPolygonFeature {
        let steps = Const.circleSteps
        let mPerLat = 111_320.0
        let mPerLng = 111_320.0 * cos(center.latitude * .pi / 180)
        var coords: [CLLocationCoordinate2D] = []
        for i in 0...steps {
            let angle = Double(i) / Double(steps) * 2 * .pi
            let dx = radiusMeters * cos(angle)
            let dy = radiusMeters * sin(angle)
            coords.append(CLLocationCoordinate2D(
                latitude: center.latitude + dy / mPerLat,
                longitude: center.longitude + (mPerLng != 0 ? dx / mPerLng : 0)))
        }
        return MLNPolygonFeature(coordinates: coords, count: UInt(coords.count))
    }

    // MARK: routes

    private func renderRoutes(_ style: MLNStyle) {
        let valid = routes.filter { $0.coordinates.count >= 2 }
        let lineFeatures = valid.map { lineFeature(for: $0) }
        let pointFeatures = valid.flatMap { endpointFeatures(for: $0) }
        let lineCollection = MLNShapeCollectionFeature(shapes: lineFeatures)
        let pointCollection = MLNShapeCollectionFeature(shapes: pointFeatures)

        if let lineSource = routeLineSource, let pointSource = routePointSource {
            lineSource.shape = lineCollection
            pointSource.shape = pointCollection
            return
        }

        let lineSource = MLNShapeSource(identifier: Const.routeSource, shape: lineCollection, options: nil)
        let pointSource = MLNShapeSource(identifier: Const.routePointsSource, shape: pointCollection, options: nil)
        style.addSource(lineSource)
        style.addSource(pointSource)
        routeLineSource = lineSource
        routePointSource = pointSource
        addRouteLayers(style)
    }

    private func lineFeature(for route: CarRouteData) -> MLNPolylineFeature {
        var coords = route.coordinates
        let feature = MLNPolylineFeature(coordinates: &coords, count: UInt(coords.count))
        feature.attributes = [
            "weight": route.weight,
            "color": route.color ?? Const.routeArrowFallbackColor,
            "opacity": route.opacity,
            "iconColor": arrowIconColor(route.color, opacity: route.opacity),
            "iconSize": arrowIconSize(route.weight)
        ]
        return feature
    }

    private func endpointFeatures(for route: CarRouteData) -> [MLNPointFeature] {
        let start = MLNPointFeature()
        start.coordinate = route.coordinates.first!
        start.attributes = ["color": Const.routeStartColor, "strokeColor": "white"]
        let end = MLNPointFeature()
        end.coordinate = route.coordinates.last!
        end.attributes = ["color": Const.routeEndColor, "strokeColor": "white"]
        return [start, end]
    }

    private func addRouteLayers(_ style: MLNStyle) {
        let line = MLNLineStyleLayer(identifier: Const.routeLayer, source: routeLineSource!)
        line.lineColor = NSExpression(forKeyPath: "color")
        line.lineWidth = NSExpression(forKeyPath: "weight")
        line.lineOpacity = NSExpression(forKeyPath: "opacity")
        line.lineCap = NSExpression(forConstantValue: "butt")
        line.lineJoin = NSExpression(forConstantValue: "bevel")

        let arrows = MLNSymbolStyleLayer(identifier: Const.routeArrowsLayer, source: routeLineSource!)
        arrows.symbolPlacement = NSExpression(forConstantValue: "line")
        arrows.symbolSpacing = NSExpression(forConstantValue: 40)
        arrows.iconImageName = NSExpression(forConstantValue: Const.routeArrowIconImage)
        arrows.iconScale = NSExpression(forKeyPath: "iconSize")
        arrows.iconColor = NSExpression(forKeyPath: "iconColor")
        arrows.iconAllowsOverlap = NSExpression(forConstantValue: true)
        arrows.iconIgnoresPlacement = NSExpression(forConstantValue: true)

        let points = MLNCircleStyleLayer(identifier: Const.routePointsLayer, source: routePointSource!)
        points.circleColor = NSExpression(forKeyPath: "color")
        points.circleRadius = NSExpression(forConstantValue: 7)
        points.circleStrokeColor = NSExpression(forKeyPath: "strokeColor")
        points.circleStrokeWidth = NSExpression(forConstantValue: 3)

        // Routes render below the layering anchor (under labels), arrows/points just above the line.
        insertBelowAnchor(line, in: style)
        if let above = style.layer(withIdentifier: Const.routeLayer) {
            style.insertLayer(arrows, above: above)
            style.insertLayer(points, above: arrows)
        } else {
            style.addLayer(arrows)
            style.addLayer(points)
        }
    }

    /// Mirrors selectedRouteService.routeToProperties: invert opaque route colors to keep the arrow
    /// visible; otherwise reuse the route color so the arrow blends into the line.
    private func arrowIconColor(_ routeColor: String?, opacity: Double) -> String {
        guard let color = routeColor else { return Const.routeArrowFallbackColor }
        if opacity <= Const.arrowInvertOpacityThreshold { return color }
        guard let rgb = UIColor.rgbComponents(fromHex: color) else { return color }
        let invR = 1 - rgb.r, invG = 1 - rgb.g, invB = 1 - rgb.b
        let luminance = 0.2126 * channelToLinear(invR)
            + 0.7152 * channelToLinear(invG)
            + 0.0722 * channelToLinear(invB)
        return luminance < Const.bwLuminanceThreshold ? "#000000" : "#FFFFFF"
    }

    private func arrowIconSize(_ weight: Double) -> Double {
        weight < Const.arrowBaseWeight ? Const.arrowBaseSize : Const.arrowBaseSize * weight / Const.arrowBaseWeight
    }

    private func channelToLinear(_ channel: CGFloat) -> Double {
        let c = Double(channel)
        return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }

    // MARK: layer insertion relative to the anchor

    private func insertBelowAnchor(_ layer: MLNStyleLayer, in style: MLNStyle) {
        if let anchor = style.layer(withIdentifier: Self.layeringAnchorId) {
            style.insertLayer(layer, below: anchor)
        } else {
            style.addLayer(layer)
        }
    }

    private func insertAboveAnchor(_ layer: MLNStyleLayer, in style: MLNStyle) {
        if let anchor = style.layer(withIdentifier: Self.layeringAnchorId) {
            style.insertLayer(layer, above: anchor)
        } else {
            style.addLayer(layer)
        }
    }

    // MARK: interaction (driven by CarPlay buttons / pan interface)

    func scrollBy(dx: CGFloat, dy: CGFloat) {
        lastUserInteraction = Date()
        let center = mapView.centerCoordinate
        var point = mapView.convert(center, toPointTo: mapView)
        point.x -= dx
        point.y -= dy
        let newCenter = mapView.convert(point, toCoordinateFrom: mapView)
        mapView.setCenter(newCenter, animated: false)
    }

    func zoomIn() { zoom(by: 1) }
    func zoomOut() { zoom(by: -1) }

    private func zoom(by delta: Double) {
        lastUserInteraction = Date()
        let target = min(mapView.maximumZoomLevel,
                         max(mapView.minimumZoomLevel, mapView.zoomLevel + delta))
        mapView.setZoomLevel(target, animated: true)
        // setZoomLevel is async, so persist the known target rather than the pre-animation value.
        persistZoom(target)
    }

    func recenter() {
        lastUserInteraction = .distantPast
        if let location = currentLocation() {
            centerOn(location)
        } else {
            center(on: loadLastKnownLocation(), course: -1)
        }
    }

    func mapView(_ mapView: MLNMapView, regionDidChangeWith reason: MLNCameraChangeReason, animated: Bool) {
        // Persist only when the user changed zoom via a pinch / zoom gesture. Pan, recenter and the
        // follow animation are programmatic and must not write; button zoom persists its own target.
        let zoomGestures: MLNCameraChangeReason = [.gesturePinch, .gestureZoomIn, .gestureZoomOut, .gestureOneFingerZoom]
        if !reason.isDisjoint(with: zoomGestures) { persistZoom(mapView.zoomLevel) }
    }

    private func persistZoom(_ zoom: Double) {
        if zoom != lastSavedZoom {
            lastSavedZoom = zoom
            store.saveDouble(CarStoreKeys.zoom, zoom)
        }
    }

    // MARK: helpers

    private func loadStyleImage(_ style: MLNStyle, resource: String, name: String, sdf: Bool, scale: CGFloat) {
        guard let url = Bundle.main.url(forResource: resource, withExtension: "png", subdirectory: "public/content"),
              let data = try? Data(contentsOf: url),
              let image = UIImage(data: data, scale: scale) else { return }
        style.setImage(sdf ? image.withRenderingMode(.alwaysTemplate) : image, forName: name)
    }

    /// Loads the style straight from the JSON string (injecting the layering anchor first), falling
    /// back to the default remote style when nothing has been pushed yet. Asynchronous; completion
    /// arrives via mapView(_:didFinishLoading:), where the images and route/location layers are
    /// (re)added.
    private func applyStyle(_ json: String?) {
        if let json = json {
            mapView.styleJSON = addLayeringAnchor(to: json)
        } else {
            mapView.styleURL = URL(string: Const.defaultStyleUrl)
        }
    }

    /// Injects an invisible anchor source and layer into the style so that location layers can be
    /// added above it and route layers below it. Mirrors addLayeringAnchorTo in CarMapContainer.kt.
    private func addLayeringAnchor(to json: String) -> String {
        guard let data = json.data(using: .utf8),
              var style = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return json }

        var sources = style["sources"] as? [String: Any] ?? [:]
        sources[Self.layeringAnchorSourceId] = [
            "type": "geojson",
            "data": ["type": "FeatureCollection", "features": []]
        ]
        style["sources"] = sources

        var layers = style["layers"] as? [[String: Any]] ?? []
        layers.append([
            "id": Self.layeringAnchorId,
            "type": "circle",
            "source": Self.layeringAnchorSourceId,
            "layout": ["visibility": "none"]
        ])
        style["layers"] = layers

        guard let outData = try? JSONSerialization.data(withJSONObject: style),
              let out = String(data: outData, encoding: .utf8)
        else { return json }
        return out
    }

    /**
     * Last lat/lng we ever received from GPS, used to center the map on launch before a fresh fix
     * arrives. Falls back to London on a cold install with no saved fix so the map never opens at
     * (0, 0). The returned coordinate has no speed/bearing/accuracy and must not feed ETA.
     */
    private func loadLastKnownLocation() -> CLLocationCoordinate2D {
        CLLocationCoordinate2D(
            latitude: store.loadDouble(CarStoreKeys.lastLat, default: Const.defaultLat),
            longitude: store.loadDouble(CarStoreKeys.lastLng, default: Const.defaultLng))
    }

    private enum Const {
        static let locationPointSource = "location-point-source"
        static let locationCircleSource = "location-circle-source"
        static let locationIconLayer = "location-icon-layer"
        static let locationCircleLayer = "location-accuracy-circle-layer"
        static let locationCircleStrokeLayer = "location-accuracy-circle-stroke-layer"
        static let locationIconImage = "gps-arrow"
        static let accuracyColor = UIColor(red: 0x13 / 255, green: 0x6A / 255, blue: 0xEC / 255, alpha: 1)

        static let routeSource = "planned-route-source"
        static let routePointsSource = "planned-route-points-source"
        static let routeLayer = "planned-route-layer"
        static let routeArrowsLayer = "planned-route-arrows-layer"
        static let routePointsLayer = "planned-route-points-layer"
        static let routeStartColor = "#43a047"
        static let routeEndColor = "red"
        static let routeArrowIconImage = "arrow"
        static let routeArrowFallbackColor = "#FFFFFF"

        static let arrowInvertOpacityThreshold = 0.5
        static let arrowBaseWeight = 10.0
        static let arrowBaseSize = 1.6
        static let bwLuminanceThreshold = 0.1791288
        static let circleSteps = 64
        static let panSuppression: TimeInterval = 5
        static let cameraEase: TimeInterval = 0.25

        static let defaultZoom = 14.0
        // Cold-install fallbacks; see loadLastKnownLocation / applyStyle.
        static let defaultLat = 51.5074
        static let defaultLng = -0.1278
        static let defaultStyleUrl =
            "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/mapeak-hike.json"
    }
}

private extension UIColor {
    /// Parses "#rrggbb" / "#rgb" hex strings into 0...1 components (named colors are left to MapLibre).
    static func rgbComponents(fromHex hex: String) -> (r: CGFloat, g: CGFloat, b: CGFloat)? {
        var s = hex.trimmingCharacters(in: .whitespaces)
        guard s.hasPrefix("#") else { return nil }
        s.removeFirst()
        if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
        guard s.count == 6, let value = UInt32(s, radix: 16) else { return nil }
        return (CGFloat((value >> 16) & 0xFF) / 255,
                CGFloat((value >> 8) & 0xFF) / 255,
                CGFloat(value & 0xFF) / 255)
    }
}
