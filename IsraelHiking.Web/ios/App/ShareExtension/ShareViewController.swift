import MapKit
import UIKit
import UniformTypeIdentifiers

/**
 * `UIApplication` is unavailable to an extension, so the object found on the responder chain cannot be
 * typed as one. Declaring the selector lets it be called without importing the class.
 *
 * `options` is deliberately untyped and always passed as nil: the object that answers this selector is
 * a scene rather than the application, and it expects a `UISceneOpenExternalURLOptions` - passing a
 * dictionary makes it call `universalLinksOnly` on one, which brings the whole extension down.
 */
@objc private protocol ApplicationURLOpener {
    @objc(openURL:options:completionHandler:)
    func open(_ url: URL, options: NSObject?, completionHandler: ((Bool) -> Void)?)
}

/**
 * Receives a location shared into Mapeak from another app - most commonly Google Maps or Apple Maps.
 *
 * There is deliberately no UI: nothing here needs filling in, so the extension takes the location,
 * brings the app to the front on `mapeak://share?sharedText=...` and gets out of the way. It also
 * leaves the location in the shared app group, where CapacitorShareTargetPlugin picks it up whenever
 * the app becomes active - that is what the confirmation alert falls back on if the app cannot be
 * opened.
 *
 * Everything is handed over as text, because the app already knows how to turn both a map link and a
 * plain "lat, lng" pair into a point - so a structured map item needs no protocol of its own.
 */
final class ShareViewController: UIViewController {

    private static let appGroupId = "group.com.mapeak"
    private static let sharedDataKey = "share-target-data"
    private static let hostAppUrl = "mapeak://share"
    /** Apple Maps attaches the shared place as an `MKMapItem` under this type identifier */
    private static let mapItemTypeIdentifier = "com.apple.mapkit.map-item"

    private var hasHandledShare = false

    /**
     * The work is started once the view is on screen rather than in `viewDidLoad`: until then this
     * controller is not in a window, so the responder chain does not yet reach the object that can
     * open a url, and the app could never be brought to the front.
     */
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if hasHandledShare {
            return
        }
        hasHandledShare = true
        Task {
            let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
            guard let text = await collectSharedText(from: items) else {
                extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                return
            }
            store(text)
            openHostApp(with: text) { opened in
                guard opened else {
                    self.confirmAndDismiss()
                    return
                }
                // Completing tears this extension down, which cancels a launch still in flight, so the
                // system is given a moment to actually switch apps first.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                }
            }
        }
    }

    /**
     * Apple Maps attaches the place as a map item, which states it exactly and so wins outright over
     * the `maps.apple/p/` link it comes with, since that holds no coordinates and cannot be resolved
     * into any. Everyone else shares a link, as a url or occasionally as plain text.
     */
    private func collectSharedText(from items: [NSExtensionItem]) async -> String? {
        for item in items {
            for provider in item.attachments ?? [] {
                if let coordinate = await mapItemCoordinate(from: provider) {
                    return coordinate
                }
                if let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                    return url.absoluteString
                }
                if let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    return text
                }
            }
        }
        return nil
    }

    /**
     * Reads the coordinate out of an Apple Maps share, which is the supported way to get at it - the
     * accompanying url is explicitly not meant to be parsed. Depending on the sender the item arrives
     * either as an `MKMapItem` or as its archived form, so both are accepted.
     */
    private func mapItemCoordinate(from provider: NSItemProvider) async -> String? {
        guard provider.hasItemConformingToTypeIdentifier(Self.mapItemTypeIdentifier),
              let item = try? await provider.loadItem(forTypeIdentifier: Self.mapItemTypeIdentifier) else {
            return nil
        }
        var mapItem = item as? MKMapItem
        if mapItem == nil, let data = item as? Data {
            mapItem = try? NSKeyedUnarchiver.unarchivedObject(ofClass: MKMapItem.self, from: data)
        }
        // A placemark carries its location in either of these, and an empty one answers both
        guard let placemark = mapItem?.placemark,
              let coordinate = Self.usableCoordinate(placemark.location?.coordinate)
                ?? Self.usableCoordinate(placemark.coordinate) else {
            return nil
        }
        // Formatted without a locale so the separator stays a dot, which is what the app parses
        return String(format: "%.6f, %.6f", coordinate.latitude, coordinate.longitude)
    }

    /**
     * Null Island is what an unpopulated placemark reports, and it passes `CLLocationCoordinate2DIsValid`
     * because both of its values are in range - so it has to be rejected by name, or a share with no
     * location in it silently sends the user to the middle of the Atlantic.
     */
    private static func usableCoordinate(_ coordinate: CLLocationCoordinate2D?) -> CLLocationCoordinate2D? {
        guard let coordinate, CLLocationCoordinate2DIsValid(coordinate),
              coordinate.latitude != 0 || coordinate.longitude != 0 else {
            return nil
        }
        return coordinate
    }

    /** Leaves the location where the plugin can find it, for when the app cannot be brought forward */
    private func store(_ text: String) {
        guard let userDefaults = UserDefaults(suiteName: Self.appGroupId) else {
            return
        }
        userDefaults.set(["title": "", "texts": [text], "files": []], forKey: Self.sharedDataKey)
    }

    /**
     * Brings the app to the front, the way Waze and others do when a location is shared to them.
     *
     * There is no supported API for this - `UIApplication` is unavailable to an extension - so it is
     * looked up on the responder chain instead. It must be the non-deprecated
     * `openURL:options:completionHandler:`: from iOS 18 on, UIKit refuses the older `openURL:` with
     * "Force returning false" and tells the caller to migrate to this one.
     *
     * Failure is not fatal, which is why the completion is honoured rather than assumed: the user is
     * shown the confirmation instead, and the plugin hands the location over when the app is opened.
     */
    private func openHostApp(with text: String, completion: @escaping (Bool) -> Void) {
        // The location travels in the url rather than only through the app group, which is written to
        // one process and read from another and flushed lazily in between. A url arrives with the
        // launch itself, so there is nothing to race. Everything outside the unreserved set is escaped,
        // so a `+` in a map link survives as a `+` instead of being read back as a space.
        let unreserved = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        guard let escaped = text.addingPercentEncoding(withAllowedCharacters: unreserved),
              let url = URL(string: "\(Self.hostAppUrl)?sharedText=\(escaped)") else {
            completion(false)
            return
        }
        let selector = NSSelectorFromString("openURL:options:completionHandler:")
        var responder: UIResponder? = self
        while let current = responder {
            if current.responds(to: selector) {
                unsafeBitCast(current, to: ApplicationURLOpener.self).open(url, options: nil) { opened in
                    DispatchQueue.main.async { completion(opened) }
                }
                return
            }
            responder = current.next
        }
        completion(false)
    }

    /**
     * Tells the user the location was taken, when the app could not be brought to the front to show it.
     * The plugin picks the location up from the app group the next time the app becomes active, so
     * nothing is lost - it just takes the user opening the app themselves.
     */
    private func confirmAndDismiss() {
        let translations = Translations.load(language: Translations.deviceLanguage())
        let alert = UIAlertController(
            title: "Mapeak",
            message: translations.getString("The location was shared, open the app to see it on the map."),
            preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: translations.getString("OK"), style: .default) { _ in
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        })
        present(alert, animated: true)
    }
}
