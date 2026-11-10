import BackgroundTasks
import Foundation
import OfflineDownload

/// Owns the URL sessions the tile downloads run in, see `TileDownloadCoordinator`. It is owned by the app rather
/// than by the plugin, and created at launch, so that a relaunch reconnects to the transfers of the background
/// session that are already in flight and iOS can finish them while Mapeak is suspended or terminated.
/// A download that runs in a continued task, see `ContinuedTileDownload`, runs in a session of the app's own
/// process instead, which the system does not stop while the task keeps the app running.
final class OfflineDownloadManager {
    static let shared = OfflineDownloadManager()

    static let sessionIdentifier = "com.mapeak.offline-download"
    /// The prefix of the identifiers of the continued tasks, which BGTaskSchedulerPermittedIdentifiers allows
    private static let continuedTaskIdentifierPrefix = "com.mapeak.offline-download."
    private static let defaultConcurrency = 3

    private(set) var coordinator: TileDownloadCoordinator!
    private let backgroundSession: TileTransferSession
    private let processSession: TileTransferSession
    private var continued: ContinuedTileDownload!

    /// The handler iOS hands over when it relaunched the app for the session's events, see AppDelegate
    var backgroundCompletionHandler: (() -> Void)? {
        get { backgroundSession.finishedEventsHandler }
        set { backgroundSession.finishedEventsHandler = newValue }
    }

    private init() {
        let store = TileDownloadJobStore.applicationSupport()
        let configuration = URLSessionConfiguration.background(withIdentifier: OfflineDownloadManager.sessionIdentifier)
        configuration.sessionSendsLaunchEvents = true
        configuration.isDiscretionary = false
        configuration.httpMaximumConnectionsPerHost = store.load()?.concurrency ?? OfflineDownloadManager.defaultConcurrency
        backgroundSession = TileTransferSession(configuration: configuration)
        processSession = TileTransferSession(configuration: .default)
        coordinator = TileDownloadCoordinator(store: store, transfers: backgroundSession)
        backgroundSession.coordinator = coordinator
        processSession.coordinator = coordinator
        continued = ContinuedTileDownload(coordinator: coordinator, transfers: processSession)
    }

    /// Starts a download in a continued task that shows its progress under the given title and subtitle, see
    /// `ContinuedTileDownload.start`. The task is registered right before it is submitted, under an identifier of its
    /// own, since a launch handler can only be registered once for an identifier.
    @available(iOS 26.0, *)
    func startContinued(_ job: TileDownloadJob, title: String, subtitle: String,
                        completion: @escaping (_ background: Bool, _ launchDelay: TimeInterval?) -> Void) {
        continued.start(job, submit: { launchHandler in
            let identifier = OfflineDownloadManager.continuedTaskIdentifierPrefix + UUID().uuidString
            let registered = BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { task in
                guard let task = task as? BGContinuedProcessingTask else {
                    task.setTaskCompleted(success: false)
                    return
                }
                launchHandler(SystemContinuedTask(task))
            }
            guard registered else {
                return false
            }
            let request = BGContinuedProcessingTaskRequest(identifier: identifier, title: title, subtitle: subtitle)
            request.strategy = .fail
            do {
                try BGTaskScheduler.shared.submit(request)
                return true
            } catch {
                return false
            }
        }, completion: completion)
    }
}

@available(iOS 26.0, *)
private final class SystemContinuedTask: ContinuedTask {
    private let task: BGContinuedProcessingTask

    init(_ task: BGContinuedProcessingTask) {
        self.task = task
    }

    var progress: Progress {
        task.progress
    }

    func setExpirationHandler(_ handler: @escaping () -> Void) {
        task.expirationHandler = handler
    }

    func setTaskCompleted(success: Bool) {
        task.setTaskCompleted(success: success)
    }
}

/// A URL session the transfers of a tile download run in, which hands their events to the coordinator.
/// Every transfer carries the description the coordinator gave it, which is how its events find their job.
final class TileTransferSession: NSObject, URLSessionDownloadDelegate, TileTransfers {
    weak var coordinator: TileDownloadCoordinator?
    /// Called once a background session delivered all the events it relaunched the app for
    var finishedEventsHandler: (() -> Void)?
    private var session: URLSession!

    init(configuration: URLSessionConfiguration) {
        super.init()
        let delegateQueue = OperationQueue()
        delegateQueue.maxConcurrentOperationCount = 1
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
        coordinator?.didWriteData(description: description, totalBytesWritten: totalBytesWritten,
                                  totalBytesExpected: totalBytesExpectedToWrite)
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let description = downloadTask.taskDescription else {
            return
        }
        let statusCode = (downloadTask.response as? HTTPURLResponse)?.statusCode
        coordinator?.didFinishDownloading(description: description, statusCode: statusCode, location: location)
    }

    /// A transfer that ended with an error. One that ended without an error was already handed over when it finished
    /// downloading. A cancelled transfer is either one the coordinator cancelled itself, whose events it ignores, or
    /// one iOS cancelled, which tells whether the user force-quit the app. The partial file iOS keeps for resuming a
    /// transfer is deleted by cancelling a transfer made from it, since the server can not resume one anyway.
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let error = error as NSError?, let description = task.taskDescription else {
            return
        }
        if let resumeData = error.userInfo[NSURLSessionDownloadTaskResumeData] as? Data {
            session.downloadTask(withResumeData: resumeData).cancel()
        }
        let failure: TileTransferFailure
        switch error.code {
        case NSURLErrorCancelled where error.userInfo[NSURLErrorBackgroundTaskCancelledReasonKey] as? Int
                == NSURLErrorCancelledReasonUserForceQuitApplication:
            failure = .forceQuit
        case NSURLErrorCancelled:
            failure = .interrupted
        case NSURLErrorTimedOut:
            failure = .timeout(error.localizedDescription)
        default:
            failure = .network(error.localizedDescription)
        }
        coordinator?.didFail(description: description, failure: failure)
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async {
            let handler = self.finishedEventsHandler
            self.finishedEventsHandler = nil
            handler?()
        }
    }
}
