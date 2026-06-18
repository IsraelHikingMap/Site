import Foundation

/**
 * Intercepts MapLibre tile requests carrying `?use=slice` and mirrors `SliceProtocolInterceptor.kt`:
 * try the network first (short timeout when an offline archive exists, long timeout otherwise), and
 * on failure fall back to the offline PMTiles archive. Registered on MapLibre's `URLSession`
 * configuration via `MLNNetworkConfiguration` (see `CarMapViewController.configureTileLoading`).
 */
final class SliceURLProtocol: URLProtocol {

    static let pmTiles = PMTilesService()
    static let contours = CarContourTilesProvider()

    private static let handledKey = "SliceURLProtocolHandled"
    private static let onlineTimeoutMs = 60_000.0
    private static let onlineTimeoutOfflineAvailableMs = 2_000.0

    private var dataTask: URLSessionDataTask?
    private var isStopped = false
    // One shared session for all tile fetches. Ephemeral config carries no custom protocols, so the
    // network fetch can't recurse back into us.
    private static let session = URLSession(configuration: .ephemeral)

    override class func canInit(with request: URLRequest) -> Bool {
        if URLProtocol.property(forKey: handledKey, in: request) != nil { return false }
        guard let url = request.url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let items = components.queryItems
        else { return false }
        return items.contains { $0.name == "use" && $0.value == "slice" }
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url, let parsed = SliceURLProtocol.parse(url) else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL))
            return
        }

        if let units = SliceURLProtocol.contourUnits(url) {
            serveContour(parsed: parsed, units: units)
            return
        }

        let offlineAvailable = SliceURLProtocol.pmTiles.isOfflineFileAvailable(
            z: parsed.z, x: parsed.x, y: parsed.y, type: parsed.type)
        let timeoutMs = offlineAvailable
            ? SliceURLProtocol.onlineTimeoutOfflineAvailableMs
            : SliceURLProtocol.onlineTimeoutMs

        guard let mutable = (request as NSURLRequest).mutableCopy() as? NSMutableURLRequest else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        URLProtocol.setProperty(true, forKey: SliceURLProtocol.handledKey, in: mutable)
        mutable.timeoutInterval = timeoutMs / 1000.0

        dataTask = SliceURLProtocol.session.dataTask(with: mutable as URLRequest) { [weak self] data, response, error in
            guard let self = self else { return }
            if let http = response as? HTTPURLResponse, http.statusCode == 200, let data = data {
                self.client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .notAllowed)
                self.client?.urlProtocol(self, didLoad: data)
                self.client?.urlProtocolDidFinishLoading(self)
                return
            }
            self.serveOffline(parsed: parsed, offlineAvailable: offlineAvailable,
                              networkError: error, response: response)
        }
        dataTask?.resume()
    }

    override func stopLoading() {
        isStopped = true
        dataTask?.cancel()
        dataTask = nil
    }

    private func serveOffline(parsed: (type: String, z: Int, x: Int, y: Int),
                              offlineAvailable: Bool,
                              networkError: Error?,
                              response: URLResponse?) {
        guard offlineAvailable,
              let data = SliceURLProtocol.pmTiles.getTileByType(
                z: parsed.z, x: parsed.x, y: parsed.y, type: parsed.type)
        else {
            client?.urlProtocol(self, didFailWithError: networkError ?? URLError(.resourceUnavailable))
            return
        }
        let headers = ["Content-Type": "application/x-protobuf"]
        let offlineResponse = HTTPURLResponse(
            url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
        client?.urlProtocol(self, didReceive: offlineResponse, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    private func serveContour(parsed: (type: String, z: Int, x: Int, y: Int), units: String) {
        // Generating is blocking (it fetches the DEM synchronously), so run it off the loading thread.
        DispatchQueue.global().async { [weak self] in
            guard let self = self else { return }
            do {
                let data = try SliceURLProtocol.contours.getTile(
                    z: parsed.z, x: parsed.x, y: parsed.y, units: units)
                guard !self.isStopped else { return }
                let headers = ["Content-Type": "application/x-protobuf"]
                let response = HTTPURLResponse(
                    url: self.request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
                self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                self.client?.urlProtocol(self, didLoad: data)
                self.client?.urlProtocolDidFinishLoading(self)
            } catch {
                guard !self.isStopped else { return }
                self.client?.urlProtocol(self, didFailWithError: error)
            }
        }
    }

    /// Reads the `contour=<units>` marker the web adds to the contour source tiles (see useContourQuery).
    private static func contourUnits(_ url: URL) -> String? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let items = components.queryItems
        else { return nil }
        return items.first { $0.name == "contour" }?.value
    }

    /// Parses `.../{type}/{z}/{x}/{y}.ext?use=slice` the same way `SliceProtocolInterceptor.kt` does.
    private static func parse(_ url: URL) -> (type: String, z: Int, x: Int, y: Int)? {
        let parts = url.absoluteString.components(separatedBy: "/").filter { !$0.isEmpty }
        guard parts.count >= 4 else { return nil }
        let type = parts[parts.count - 4]
        guard let z = Int(parts[parts.count - 3]),
              let x = Int(parts[parts.count - 2]),
              let yPart = parts.last?.components(separatedBy: ".").first,
              let y = Int(yPart)
        else { return nil }
        return (type, z, x, y)
    }
}
