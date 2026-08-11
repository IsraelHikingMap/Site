import Foundation

/**
 * Reads the same translation files the web app ships (bundled at public/translations/<lang>.json) so
 * native strings stay consistent with the rest of the app instead of being duplicated per surface.
 * Mirrors `CarTranslations.kt` on Android and the web GetTextCatalogService: keys are the English
 * text and a missing key falls back to the key itself, so an untranslated string still reads.
 *
 * Compiled into both the app and the share extension, which is why the bundle is resolved rather
 * than assumed - an extension's own bundle holds no translations.
 */
final class Translations {

    private let strings: [String: String]

    private init(strings: [String: String]) {
        self.strings = strings
    }

    func getString(_ key: String) -> String {
        guard let translation = strings[key], !translation.isEmpty else {
            return key
        }
        return translation
    }

    private static var cached: (language: String, translations: Translations)?

    /**
     * Loads (and caches) the translations for a full language code, e.g. "en-US" or "he", matching
     * the translation file names the same way the web does.
     */
    static func load(language: String) -> Translations {
        if let cached, cached.language == language {
            return cached.translations
        }
        let translations = Translations(strings: read(language) ?? [:])
        cached = (language, translations)
        return translations
    }

    /**
     * The language to show when the app's own choice cannot be reached - the share extension runs in
     * its own sandbox and cannot see it, so the device's preference is the closest thing available.
     */
    static func deviceLanguage() -> String {
        let catalogs = ["en-US", "he", "ru", "ar", "es"]
        for preferred in Locale.preferredLanguages {
            let code = preferred.split(separator: "-").first.map(String.init) ?? preferred
            if let match = catalogs.first(where: { $0.hasPrefix(code) }) {
                return match
            }
        }
        return "en-US"
    }

    private static func read(_ language: String) -> [String: String]? {
        let url = appBundleUrl.appendingPathComponent("public/translations/\(language).json")
        guard let data = try? Data(contentsOf: url),
              let strings = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            NSLog("[Translations] Unable to read the catalog for \(language)")
            return nil
        }
        return strings
    }

    /** An extension lives at App.app/PlugIns/<name>.appex, and the catalog ships with the app itself */
    private static var appBundleUrl: URL {
        let url = Bundle.main.bundleURL
        guard url.pathExtension == "appex" else {
            return url
        }
        return url.deletingLastPathComponent().deletingLastPathComponent()
    }
}
