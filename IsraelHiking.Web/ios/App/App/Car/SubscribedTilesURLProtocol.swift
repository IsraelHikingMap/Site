import Foundation

/**
 * Adds the user's token to the tile requests that go to our own API. The tiles of a base layer that
 * comes with the subscription - the satellite imagery - are only served to a subscribed user, and the
 * car app has no session of its own, so it uses the token the app stores for it under `CarStoreKeys.config`.
 * Mirrors `SubscribedTilesInterceptor.kt` on Android and the transform request of the web map, see
 * `MapService.setTransformRequest`. Registered on MapLibre's `URLSession` configuration alongside
 * `SliceURLProtocol` (see `CarMapViewController.configureTileLoading`).
 *
 * The token is read per request rather than held, so that a sign in or a token refresh in the app is
 * picked up without reconfiguring the session.
 */
final class SubscribedTilesURLProtocol: URLProtocol {

    private static let handledKey = "SubscribedTilesURLProtocolHandled"
    private static let apiAddress = "https://mapeak.com/api/"
    private static let tokenKey = "token"

    private var dataTask: URLSessionDataTask?
    // One shared session for all of these fetches. Ephemeral config carries no custom protocols, so the
    // network fetch can't recurse back into us.
    private static let session = URLSession(configuration: .ephemeral)

    override class func canInit(with request: URLRequest) -> Bool {
        if URLProtocol.property(forKey: handledKey, in: request) != nil { return false }
        guard let url = request.url?.absoluteString else { return false }
        return url.hasPrefix(apiAddress)
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let mutable = (request as NSURLRequest).mutableCopy() as? NSMutableURLRequest else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        URLProtocol.setProperty(true, forKey: SubscribedTilesURLProtocol.handledKey, in: mutable)
        if let token = SubscribedTilesURLProtocol.token(), !token.isEmpty {
            mutable.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        dataTask = SubscribedTilesURLProtocol.session.dataTask(with: mutable as URLRequest) {
            [weak self] data, response, error in
            guard let self = self else { return }
            if let error = error {
                self.client?.urlProtocol(self, didFailWithError: error)
                return
            }
            guard let response = response, let data = data else {
                self.client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
                return
            }
            self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            self.client?.urlProtocol(self, didLoad: data)
            self.client?.urlProtocolDidFinishLoading(self)
        }
        dataTask?.resume()
    }

    override func stopLoading() {
        dataTask?.cancel()
        dataTask = nil
    }

    private static func token() -> String? {
        CapacitorStore.shared.load(CarStoreKeys.config)?[tokenKey] as? String
    }
}
