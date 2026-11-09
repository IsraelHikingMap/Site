import Foundation
import OfflineDownload

/// Owns the one background URL session the tile downloads run in, see `TileDownloadCoordinator`. It is owned
/// by the app rather than by the plugin, and created at launch, so that a relaunch reconnects to the transfers
/// that are already in flight and iOS can finish them while Mapeak is suspended or terminated.
/// The session's connections per host are set once, when it is created, from the saved job or the default.
final class OfflineDownloadManager: NSObject, URLSessionDownloadDelegate, TileTransfers {
    static let shared = OfflineDownloadManager()

    static let sessionIdentifier = "com.mapeak.offline-download"
    private static let defaultConcurrency = 3

    private(set) var coordinator: TileDownloadCoordinator!
    private var session: URLSession!
    /// The handler iOS hands over when it relaunched the app for the session's events, see AppDelegate
    var backgroundCompletionHandler: (() -> Void)?

    private override init() {
        super.init()
        let store = TileDownloadJobStore.applicationSupport()
        let configuration = URLSessionConfiguration.background(withIdentifier: OfflineDownloadManager.sessionIdentifier)
        configuration.sessionSendsLaunchEvents = true
        configuration.isDiscretionary = false
        configuration.httpMaximumConnectionsPerHost = store.load()?.concurrency ?? OfflineDownloadManager.defaultConcurrency
        let delegateQueue = OperationQueue()
        delegateQueue.maxConcurrentOperationCount = 1
        coordinator = TileDownloadCoordinator(store: store, transfers: self)
        session = URLSession(configuration: configuration, delegate: self, delegateQueue: delegateQueue)
    }

    func enqueue(_ request: URLRequest, description: String) {
        let task = session.downloadTask(with: request)
        task.taskDescription = description
        task.resume()
    }

    func cancelTransfers(ofJob jobId: String) {
        session.getAllTasks { tasks in
            tasks.filter { $0.taskDescription?.hasPrefix("\(jobId)/") == true }.forEach { $0.cancel() }
        }
    }

    func activeDescriptions(_ completion: @escaping ([String]) -> Void) {
        session.getAllTasks { tasks in
            completion(tasks.filter { $0.state == .running || $0.state == .suspended }.compactMap { $0.taskDescription })
        }
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64,
                    totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        guard let description = downloadTask.taskDescription else {
            return
        }
        coordinator.didWriteData(description: description, totalBytesWritten: totalBytesWritten,
                                 totalBytesExpected: totalBytesExpectedToWrite)
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let description = downloadTask.taskDescription else {
            return
        }
        let statusCode = (downloadTask.response as? HTTPURLResponse)?.statusCode
        coordinator.didFinishDownloading(description: description, statusCode: statusCode, location: location)
    }

    /// A transfer that ended with an error. One that ended without an error was already handed over when it finished
    /// downloading. A cancelled transfer is either one the coordinator cancelled itself, whose events it ignores, or
    /// one iOS cancelled since the user force-quit the app, which is continued the next time the app asks about it.
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let error = error as NSError?, let description = task.taskDescription else {
            return
        }
        let failure: TileTransferFailure
        switch error.code {
        case NSURLErrorCancelled:
            failure = .interrupted
        case NSURLErrorTimedOut:
            failure = .timeout(error.localizedDescription)
        default:
            failure = .network(error.localizedDescription)
        }
        coordinator.didFail(description: description, failure: failure)
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async {
            let handler = self.backgroundCompletionHandler
            self.backgroundCompletionHandler = nil
            handler?()
        }
    }
}
