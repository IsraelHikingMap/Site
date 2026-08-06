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
    /** Apple Maps attaches the shared place as an `MKMapItem` under this type identifier */
    private static let mapItemTypeIdentifier = "com.apple.mapkit.map-item"

    override func viewDidLoad() {
        super.viewDidLoad()
        Task {
            let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
            NSLog("[ShareExtension] Started with \(items.count) item(s), " +
                  "types: \(items.flatMap { ($0.attachments ?? []).flatMap(\.registeredTypeIdentifiers) })")
            let texts = await collectSharedTexts(from: items)
            if texts.isEmpty {
                NSLog("[ShareExtension] Nothing usable was shared")
                extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                return
            }
            NSLog("[ShareExtension] Handing over: \(texts)")
            store(texts: texts)
            confirmAndDismiss()
        }
    }

    /**
     * Google Maps attaches the location as a URL, while a few apps share the very same link as plain
     * text, so both representations are collected and the app decides what to make of them.
     */
    private func collectSharedTexts(from items: [NSExtensionItem]) async -> [String] {
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
            NSLog("[ShareExtension] The map item arrived archived, decoded: \(mapItem != nil)")
        }
        guard let placemark = mapItem?.placemark else {
            NSLog("[ShareExtension] A map item was shared but could not be read as one")
            return nil
        }
        // A placemark can carry its location in either of these, and an empty one answers both
        guard let coordinate = Self.usableCoordinate(placemark.location?.coordinate)
            ?? Self.usableCoordinate(placemark.coordinate) else {
            NSLog("[ShareExtension] The shared map item \"\(placemark.name ?? "")\" holds no coordinate")
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

    private func store(texts: [String]) {
        guard let userDefaults = UserDefaults(suiteName: Self.appGroupId) else {
            NSLog("[ShareExtension] Unable to open the app group \(Self.appGroupId) - it is most " +
                  "likely missing from the entitlements this build was signed with")
            return
        }
        userDefaults.set(["title": "", "texts": texts, "files": []], forKey: Self.sharedDataKey)
        // A write that never lands leaves the app waiting for something that is not there, and the two
        // processes have no other way of noticing, so it is worth confirming.
        if userDefaults.dictionary(forKey: Self.sharedDataKey) == nil {
            NSLog("[ShareExtension] The share was written to the app group but cannot be read back")
        }
    }

    /**
     * Tells the user the location was taken, since the app cannot be brought to the front to show it:
     * iOS has no supported way for a share extension to launch its own app, and the responder chain
     * trick that used to manage it is refused outright from iOS 18 on - and risks rejection at review.
     * The plugin picks the location up from the app group the next time the app becomes active.
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
