import Foundation

/**
 * Generic reactive key-value store. Holds persistent values (in UserDefaults) and transient
 * in-memory values behind one listener API: subscribers receive a key whenever a value changes,
 * then read the current value back from the store. The store knows nothing about what the keys
 * mean. Mirrors `CapacitorStore.kt` on Android (which uses SharedPreferences) and the NGXS-style
 * "state + select" pattern on the JS side.
 */
final class CapacitorStore {

    protocol Listener: AnyObject {
        func onCarStoreUpdated(_ key: String)
    }

    static let shared = CapacitorStore()

    private static let prefsPrefix = "capacitor_store."

    private let defaults = UserDefaults.standard
    private let lock = NSRecursiveLock()

    private final class WeakListener {
        weak var value: Listener?
        init(_ value: Listener) { self.value = value }
    }
    private var listeners: [WeakListener] = []
    private var transientValues: [String: Any] = [:]

    private init() {}

    // MARK: - Listeners

    func addListener(_ listener: Listener) {
        lock.lock(); defer { lock.unlock() }
        listeners.removeAll { $0.value == nil || $0.value === listener }
        listeners.append(WeakListener(listener))
    }

    func removeListener(_ listener: Listener) {
        lock.lock(); defer { lock.unlock() }
        listeners.removeAll { $0.value == nil || $0.value === listener }
    }

    private func notifyChanged(_ key: String) {
        DispatchQueue.main.async {
            self.lock.lock()
            let snapshot = self.listeners.compactMap { $0.value }
            self.lock.unlock()
            for listener in snapshot {
                listener.onCarStoreUpdated(key)
            }
        }
    }

    // MARK: - Persistent values

    /// Persist a JSON string value and notify listeners.
    func save(_ key: String, _ json: String) {
        defaults.set(json, forKey: Self.prefsPrefix + key)
        notifyChanged(key)
    }

    /// Remove a persisted value and notify listeners.
    func remove(_ key: String) {
        defaults.removeObject(forKey: Self.prefsPrefix + key)
        notifyChanged(key)
    }

    func loadString(_ key: String) -> String? {
        defaults.string(forKey: Self.prefsPrefix + key)
    }

    func load(_ key: String) -> [String: Any]? {
        guard let raw = defaults.string(forKey: Self.prefsPrefix + key),
              let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return obj
    }

    /// Persist a primitive value. Not part of the listener contract.
    func saveDouble(_ key: String, _ value: Double) {
        defaults.set(value, forKey: Self.prefsPrefix + key)
    }

    func loadDouble(_ key: String, default defaultValue: Double) -> Double {
        if defaults.object(forKey: Self.prefsPrefix + key) == nil { return defaultValue }
        return defaults.double(forKey: Self.prefsPrefix + key)
    }

    // MARK: - Transient (in-memory) values

    /// Set a transient (in-memory) value and notify listeners. Passing nil clears the value.
    func setTransient(_ key: String, _ value: Any?) {
        lock.lock()
        if let value = value {
            transientValues[key] = value
        } else {
            transientValues.removeValue(forKey: key)
        }
        lock.unlock()
        notifyChanged(key)
    }

    func getTransient<T>(_ key: String) -> T? {
        lock.lock(); defer { lock.unlock() }
        return transientValues[key] as? T
    }
}


