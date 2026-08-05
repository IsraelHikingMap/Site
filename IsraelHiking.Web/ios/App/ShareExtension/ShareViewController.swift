import MapKit
import UIKit
import UniformTypeIdentifiers

/**
 * Receives a location shared into Mapeak from another app - most commonly Google Maps or Apple Maps.
 *
 * An extension runs in its own process and cannot reach the app's sandbox, so the payload is handed
 * over through the shared app group and picked up by CapacitorShareTargetPlugin, which reads the
 * same `share-target-data` key on launch and whenever the app becomes active. There is deliberately
 * no UI here: there is nothing for the user to fill in, so the extension hands off and dismisses.
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

    override func viewDidLoad() {
        super.viewDidLoad()
        Task {
            let texts = await collectSharedTexts()
            if !texts.isEmpty {
                store(texts: texts)
                openHostApp()
            }
            extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }

    /**
     * Google Maps attaches the location as a URL, while a few apps share the very same link as plain
     * text, so both representations are collected and the app decides what to make of them.
     */
    private func collectSharedTexts() async -> [String] {
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        var texts: [String] = []
        for item in items {
            for provider in item.attachments ?? [] {
                if let coordinate = await loadMapItemCoordinate(from: provider) {
                    return [coordinate]
                }
                if let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                    texts.append(url.absoluteString)
                } else if let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    texts.append(text)
                }
            }
        }
        return texts
    }

    /**
     * Reads the coordinate out of an Apple Maps share. This is the supported way to get at it - the
     * accompanying URL is explicitly not meant to be parsed. Depending on the sender the item arrives
     * either as an `MKMapItem` or as its archived form, so both are accepted.
     */
    private func loadMapItemCoordinate(from provider: NSItemProvider) async -> String? {
        guard provider.hasItemConformingToTypeIdentifier(Self.mapItemTypeIdentifier),
              let item = try? await provider.loadItem(forTypeIdentifier: Self.mapItemTypeIdentifier) else {
            return nil
        }
        var mapItem = item as? MKMapItem
        if mapItem == nil, let data = item as? Data {
            mapItem = try? NSKeyedUnarchiver.unarchivedObject(ofClass: MKMapItem.self, from: data)
        }
        guard let coordinate = mapItem?.placemark.coordinate, CLLocationCoordinate2DIsValid(coordinate) else {
            NSLog("[ShareExtension] A map item was shared but held no usable coordinate")
            return nil
        }
        // Formatted without a locale so the separator stays a dot, which is what the app parses
        return String(format: "%.6f, %.6f", coordinate.latitude, coordinate.longitude)
    }

    private func store(texts: [String]) {
        guard let userDefaults = UserDefaults(suiteName: Self.appGroupId) else {
            NSLog("[ShareExtension] Unable to open the app group \(Self.appGroupId)")
            return
        }
        userDefaults.set(["title": "", "texts": texts, "files": []], forKey: Self.sharedDataKey)
    }

    /**
     * Brings the app to the front so the shared location opens straight away. An extension has no
     * `UIApplication.shared`, hence walking the responder chain. Failing to open is not fatal - the
     * plugin also reads the app group when the app next becomes active.
     */
    private func openHostApp() {
        guard let url = URL(string: Self.hostAppUrl) else {
            return
        }
        var responder: UIResponder? = self
        while let current = responder {
            if let application = current as? UIApplication {
                application.perform(#selector(openURL(_:)), with: url)
                return
            }
            responder = current.next
        }
    }

    /** Only declared so that `#selector` above resolves - `UIApplication` provides the implementation. */
    @objc private func openURL(_ url: URL) {}
}
