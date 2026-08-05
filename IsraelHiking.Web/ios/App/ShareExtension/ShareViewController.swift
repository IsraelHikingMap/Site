import UIKit
import UniformTypeIdentifiers

/**
 * Receives a URL or a piece of text shared into Mapeak from another app - most commonly a location
 * shared from Google Maps.
 *
 * An extension runs in its own process and cannot reach the app's sandbox, so the payload is handed
 * over through the shared app group and picked up by CapacitorShareTargetPlugin, which reads the
 * same `share-target-data` key on launch and whenever the app becomes active. There is deliberately
 * no UI here: there is nothing for the user to fill in, so the extension hands off and dismisses.
 */
final class ShareViewController: UIViewController {

    private static let appGroupId = "group.com.mapeak"
    private static let sharedDataKey = "share-target-data"
    private static let hostAppUrl = "mapeak://share"

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
                if let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                    texts.append(url.absoluteString)
                } else if let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    texts.append(text)
                }
            }
        }
        return texts
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
